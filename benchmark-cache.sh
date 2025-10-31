#!/bin/bash

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== Git Proxy Hybrid Cache Benchmark ===${NC}"
echo ""

# Configuration
PROXY_URL="http://localhost:8000"
GITHUB_REPO="${1:-fabiovincenzi/open-webui}"
TEST_BRANCH="${2:-main}"
NUM_PUSHES="${3:-3}"

# Construct proxy URL (format: http://localhost:8000/github.com/user/repo.git)
PROXY_REPO_URL="$PROXY_URL/github.com/$GITHUB_REPO.git"

echo "Configuration:"
echo "  Proxy URL: $PROXY_URL"
echo "  GitHub Repo: $GITHUB_REPO"
echo "  Proxy Repo URL: $PROXY_REPO_URL"
echo "  Branch: $TEST_BRANCH"
echo "  Number of pushes: $NUM_PUSHES"
echo ""

# Check if git-proxy is running
echo -e "${YELLOW}Checking if git-proxy is running...${NC}"
if ! curl -s "$PROXY_URL" > /dev/null 2>&1; then
    echo -e "${RED}ERROR: git-proxy is not running on $PROXY_URL${NC}"
    echo "Please start git-proxy with: npm start"
    exit 1
fi
echo -e "${GREEN}✓ git-proxy is running${NC}"
echo ""

# Get GitHub credentials from git credential helper
echo -e "${YELLOW}Retrieving GitHub credentials...${NC}"
CREDENTIALS=$(echo -e "protocol=https\nhost=github.com\n" | git credential fill 2>/dev/null)
if [ -z "$CREDENTIALS" ]; then
    echo -e "${RED}ERROR: No GitHub credentials found${NC}"
    echo "Please configure git credentials first:"
    echo "  git config --global credential.helper store"
    echo "  git clone https://github.com/your-repo.git"
    exit 1
fi

GITHUB_USERNAME=$(echo "$CREDENTIALS" | grep "^username=" | cut -d= -f2)
GITHUB_TOKEN=$(echo "$CREDENTIALS" | grep "^password=" | cut -d= -f2)

if [ -z "$GITHUB_USERNAME" ] || [ -z "$GITHUB_TOKEN" ]; then
    echo -e "${RED}ERROR: Could not extract GitHub credentials${NC}"
    exit 1
fi

echo -e "${GREEN}✓ GitHub credentials retrieved for user: $GITHUB_USERNAME${NC}"
echo ""

# Setup test directory
TEST_DIR="./benchmark-test-$(date +%s)"
echo -e "${YELLOW}Creating test directory: $TEST_DIR${NC}"
mkdir -p "$TEST_DIR"
cd "$TEST_DIR"

REPO_NAME=$(basename "$GITHUB_REPO")

# Clear cache before starting
echo -e "${YELLOW}Clearing cache before benchmark...${NC}"
rm -rf ../.remote/cache/* ../.remote/work/* 2>/dev/null || true
echo -e "${GREEN}✓ Cache cleared${NC}"
echo ""

measure_push() {
    local push_number=$1
    local is_first=$2

    echo -e "${BLUE}=== Push #$push_number $([ "$is_first" = "true" ] && echo "(COLD CACHE)" || echo "(WARM CACHE)") ===${NC}"

    # Clone repo through proxy
    echo "Cloning repository..."
    START_CLONE=$(date +%s.%N)

    rm -rf "$REPO_NAME" 2>/dev/null || true
    git clone "$PROXY_REPO_URL" "$REPO_NAME" > clone.log 2>&1

    END_CLONE=$(date +%s.%N)
    CLONE_TIME=$(echo "$END_CLONE - $START_CLONE" | bc)

    cd "$REPO_NAME"

    # Get email from git config
    GITHUB_EMAIL=$(git config --global user.email)
    if [ -z "$GITHUB_EMAIL" ]; then
        GITHUB_EMAIL="$GITHUB_USERNAME@users.noreply.github.com"
    fi

    git config user.email "$GITHUB_EMAIL"
    git config user.name "$GITHUB_USERNAME"

    # Create a test commit
    echo "benchmark-$push_number-$(date +%s)" > "benchmark-$push_number.txt"
    git add "benchmark-$push_number.txt"
    git commit -m "Benchmark push #$push_number" > /dev/null 2>&1

    # Push through proxy with credentials
    echo "Pushing commit..."
    START_PUSH=$(date +%s.%N)

    # Use credential helper to pass GitHub credentials
    git -c credential.helper="!f() { echo username=$GITHUB_USERNAME; echo password=$GITHUB_TOKEN; }; f" \
        push "$PROXY_REPO_URL" "HEAD:refs/heads/benchmark-test-$push_number" > push.log 2>&1 || true

    END_PUSH=$(date +%s.%N)
    PUSH_TIME=$(echo "$END_PUSH - $START_PUSH" | bc)

    TOTAL_TIME=$(echo "$CLONE_TIME + $PUSH_TIME" | bc)

    cd ..

    echo -e "${GREEN}Results:${NC}"
    echo "  Clone time: ${CLONE_TIME}s"
    echo "  Push time:  ${PUSH_TIME}s"
    echo "  Total time: ${TOTAL_TIME}s"
    echo ""

    # Store results
    echo "$push_number,$is_first,$CLONE_TIME,$PUSH_TIME,$TOTAL_TIME" >> results.csv
}

# Initialize results file
echo "push_number,is_cold_cache,clone_time,push_time,total_time" > results.csv

# Measure first push (cold cache)
measure_push 1 true

# Get cache stats after first push
echo -e "${BLUE}=== Cache Statistics After First Push ===${NC}"
CACHE_DIR="../.remote/cache"
if [ -d "$CACHE_DIR" ]; then
    CACHE_SIZE=$(du -sh "$CACHE_DIR" | cut -f1)
    CACHE_REPOS=$(ls -1 "$CACHE_DIR" | wc -l)
    echo "  Cache size: $CACHE_SIZE"
    echo "  Cached repos: $CACHE_REPOS"
else
    echo "  Cache directory not found"
fi
echo ""

# Measure subsequent pushes (warm cache)
for i in $(seq 2 $NUM_PUSHES); do
    measure_push $i false
done

# Final cache stats
echo -e "${BLUE}=== Final Cache Statistics ===${NC}"
if [ -d "$CACHE_DIR" ]; then
    CACHE_SIZE=$(du -sh "$CACHE_DIR" | cut -f1)
    CACHE_REPOS=$(ls -1 "$CACHE_DIR" | wc -l)
    echo "  Cache size: $CACHE_SIZE"
    echo "  Cached repos: $CACHE_REPOS"
    echo ""
    echo "  Cached repositories:"
    ls -lh "$CACHE_DIR" | tail -n +2 | awk '{print "    " $9 " (" $5 ")"}'
fi
echo ""

# Calculate and display summary
echo -e "${BLUE}=== Performance Summary ===${NC}"
echo ""

# Read results
FIRST_PUSH_TIME=$(awk -F, 'NR==2 {print $5}' results.csv)
AVG_WARM_TIME=$(awk -F, 'NR>2 {sum+=$5; count++} END {if(count>0) print sum/count; else print 0}' results.csv)

echo "First push (cold cache):  ${FIRST_PUSH_TIME}s"
if (( $(echo "$AVG_WARM_TIME > 0" | bc -l) )); then
    echo "Average warm push:        ${AVG_WARM_TIME}s"
    SPEEDUP=$(echo "scale=2; $FIRST_PUSH_TIME / $AVG_WARM_TIME" | bc)
    IMPROVEMENT=$(echo "scale=1; (1 - $AVG_WARM_TIME / $FIRST_PUSH_TIME) * 100" | bc)
    echo ""
    echo -e "${GREEN}Performance improvement: ${IMPROVEMENT}% faster (${SPEEDUP}x speedup)${NC}"
fi
echo ""

# Show detailed results table
echo -e "${BLUE}=== Detailed Results ===${NC}"
echo ""
printf "%-12s %-12s %-12s %-12s %-12s\n" "Push #" "Cache" "Clone (s)" "Push (s)" "Total (s)"
printf "%-12s %-12s %-12s %-12s %-12s\n" "------" "-----" "---------" "--------" "---------"
awk -F, 'NR>1 {
    cache = ($2 == "true") ? "COLD" : "WARM"
    printf "%-12s %-12s %-12.2f %-12.2f %-12.2f\n", $1, cache, $3, $4, $5
}' results.csv
echo ""

# Cleanup prompt
echo -e "${YELLOW}Test directory: $TEST_DIR${NC}"
echo "To clean up: rm -rf $TEST_DIR"
echo ""
echo -e "${GREEN}✓ Benchmark complete!${NC}"
