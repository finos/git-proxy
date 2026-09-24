#!/bin/bash

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

echo -e "${BOLD}${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BOLD}${BLUE}   Git Proxy Hybrid Cache - Detailed Performance Benchmark${NC}"
echo -e "${BOLD}${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""

PROXY_URL="http://localhost:8000"
GITHUB_REPO="${1}"
TEST_BRANCH="${2:-main}"
NUM_PUSHES="${3:-10}"

if [ -z "$GITHUB_REPO" ]; then
    echo -e "${RED}ERROR: GitHub repository required${NC}"
    echo ""
    echo "Usage: $0 <owner/repo> [branch] [num_pushes]"
    echo "Example: $0 yourFork/backstage main 10"
    echo ""
    echo -e "${YELLOW}Note: You must have push access to the specified repository${NC}"
    exit 1
fi

PROXY_REPO_URL="$PROXY_URL/github.com/$GITHUB_REPO.git"

echo -e "${CYAN}Configuration:${NC}"
echo "  Proxy URL:        $PROXY_URL"
echo "  GitHub Repo:      $GITHUB_REPO"
echo "  Branch:           $TEST_BRANCH"
echo "  Number of pushes: $NUM_PUSHES (1 cold + $((NUM_PUSHES-1)) warm)"
echo ""

echo -e "${YELLOW}[1/5] Checking git-proxy status...${NC}"
if ! curl -s "$PROXY_URL" > /dev/null 2>&1; then
    echo -e "${RED}✗ ERROR: git-proxy not running on $PROXY_URL${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Git-proxy is running${NC}\n"

echo -e "${YELLOW}[2/5] Retrieving GitHub credentials...${NC}"
CREDENTIALS=$(echo -e "protocol=https\nhost=github.com\n" | git credential fill 2>/dev/null)
if [ -z "$CREDENTIALS" ]; then
    echo -e "${RED}✗ ERROR: No GitHub credentials found${NC}"
    exit 1
fi

GITHUB_USERNAME=$(echo "$CREDENTIALS" | grep "^username=" | cut -d= -f2)
GITHUB_TOKEN=$(echo "$CREDENTIALS" | grep "^password=" | cut -d= -f2)
GITHUB_EMAIL=$(git config --global user.email || echo "$GITHUB_USERNAME@users.noreply.github.com")
echo -e "${GREEN}✓ Credentials retrieved for: $GITHUB_USERNAME${NC}\n"

TEST_DIR="./benchmark-detailed-$(date +%s)"
echo -e "${YELLOW}[3/5] Setting up test environment...${NC}"
mkdir -p "$TEST_DIR" && cd "$TEST_DIR"
REPO_NAME=$(basename "$GITHUB_REPO")

echo "  → Clearing cache..."
rm -rf ../.remote/cache/* ../.remote/work/* 2>/dev/null || true
echo -e "${GREEN}✓ Cache cleared${NC}\n"

echo -e "${YELLOW}[4/5] Performing initial clone (one-time operation)...${NC}"
echo -e "${CYAN}→ Cloning $GITHUB_REPO via proxy...${NC}\n"
START_INITIAL_CLONE=$(date +%s.%N)
git clone "$PROXY_REPO_URL" "$REPO_NAME"
CLONE_EXIT_CODE=$?
END_INITIAL_CLONE=$(date +%s.%N)

INITIAL_CLONE_TIME=$(echo "$END_INITIAL_CLONE - $START_INITIAL_CLONE" | bc)

cd "$REPO_NAME"
git config user.email "$GITHUB_EMAIL"
git config user.name "$GITHUB_USERNAME"
echo -e "${GREEN}✓ Initial clone completed in ${INITIAL_CLONE_TIME}s${NC}\n"

RESULTS_FILE="../results-detailed.csv"
echo "push_number,is_cold,push_time_s" > "$RESULTS_FILE"

perform_push() {
    local push_num=$1
    local is_cold=$2
    local label=$([ "$is_cold" = "true" ] && echo "COLD CACHE" || echo "WARM CACHE")

    echo -e "${BLUE}═══ Push #$push_num ($label) ═══${NC}"

    local commit_file="benchmark-push-$push_num-$(date +%s).txt"
    echo "Benchmark push $push_num at $(date)" > "$commit_file"
    git add "$commit_file" > /dev/null 2>&1
    git commit -m "Benchmark push #$push_num" > /dev/null 2>&1

    echo -n "  Pushing... "
    START_PUSH=$(date +%s.%N)
    PUSH_OUTPUT=$(git -c credential.helper="!f() { echo username=$GITHUB_USERNAME; echo password=$GITHUB_TOKEN; }; f" \
        push "$PROXY_REPO_URL" "HEAD:refs/heads/benchmark-test-$push_num" 2>&1)
    PUSH_EXIT_CODE=$?
    END_PUSH=$(date +%s.%N)
    PUSH_TIME=$(echo "$END_PUSH - $START_PUSH" | bc)

    if [ $PUSH_EXIT_CODE -ne 0 ]; then
        echo -e "${RED}✗ FAILED${NC}"
        echo "$PUSH_OUTPUT"
        echo ""
        exit 1
    fi

    echo -e "${GREEN}✓ ${PUSH_TIME}s${NC}"
    echo "$push_num,$is_cold,$PUSH_TIME" >> "$RESULTS_FILE"
    echo ""
}

echo -e "${YELLOW}[5/5] Running push benchmark...${NC}\n"

perform_push 1 true
for i in $(seq 2 $NUM_PUSHES); do
    perform_push $i false
done

cd ..

echo -e "${BOLD}${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BOLD}${BLUE}                    Performance Analysis                    ${NC}"
echo -e "${BOLD}${BLUE}═══════════════════════════════════════════════════════════${NC}\n"

RESULTS_CSV="results-detailed.csv"
COLD_TIME=$(awk -F, 'NR==2 {print $3}' "$RESULTS_CSV")
WARM_TIMES=$(awk -F, 'NR>2 {print $3}' "$RESULTS_CSV")

WARM_MIN=$(echo "$WARM_TIMES" | sort -n | head -1)
WARM_MAX=$(echo "$WARM_TIMES" | sort -n | tail -1)
WARM_AVG=$(echo "$WARM_TIMES" | awk '{sum+=$1; count++} END {print sum/count}')
WARM_COUNT=$(echo "$WARM_TIMES" | wc -l | tr -d ' ')
WARM_STDDEV=$(echo "$WARM_TIMES" | awk -v avg="$WARM_AVG" '{sum+=($1-avg)^2; count++} END {print sqrt(sum/count)}')

SPEEDUP=$(echo "scale=2; $COLD_TIME / $WARM_AVG" | bc)
IMPROVEMENT=$(echo "scale=1; (1 - $WARM_AVG / $COLD_TIME) * 100" | bc)

TOTAL_WARM_TIME=$(echo "$WARM_TIMES" | awk '{sum+=$1} END {print sum}')
HYPOTHETICAL_NO_CACHE=$(echo "scale=2; $COLD_TIME * $WARM_COUNT" | bc)
TIME_SAVED=$(echo "scale=2; $HYPOTHETICAL_NO_CACHE - $TOTAL_WARM_TIME" | bc)
TIME_SAVED_MINUTES=$(echo "scale=1; $TIME_SAVED / 60" | bc)

echo -e "${CYAN}${BOLD}Push Performance:${NC}\n"
printf "  %-25s %10.2fs\n" "Cold cache (Push #1):" "$COLD_TIME"
printf "  %-25s %10.2fs\n" "Warm cache (average):" "$WARM_AVG"
printf "  %-25s %10.2fs\n" "Warm cache (min):" "$WARM_MIN"
printf "  %-25s %10.2fs\n" "Warm cache (max):" "$WARM_MAX"
printf "  %-25s %10.2fs\n" "Warm cache (std dev):" "$WARM_STDDEV"

echo -e "\n${GREEN}${BOLD}Performance Improvement:${NC}\n"
printf "  %-25s %10.1f%%\n" "Speed improvement:" "$IMPROVEMENT"
printf "  %-25s %10.2fx\n" "Speedup ratio:" "$SPEEDUP"

echo -e "\n${CYAN}${BOLD}Total Time Saved:${NC}\n"
printf "  %-30s %10.2fs\n" "Total warm pushes time:" "$TOTAL_WARM_TIME"
printf "  %-30s %10.2fs\n" "Hypothetical (no cache):" "$HYPOTHETICAL_NO_CACHE"
printf "  %-30s %10.2fs (%.1fm)\n" "Time saved:" "$TIME_SAVED" "$TIME_SAVED_MINUTES"

echo -e "\n${CYAN}${BOLD}Cache Statistics:${NC}\n"
CACHE_DIR="../.remote/cache"
if [ -d "$CACHE_DIR" ]; then
    FINAL_CACHE_SIZE=$(du -sh "$CACHE_DIR" 2>/dev/null | cut -f1)
    FINAL_CACHE_COUNT=$(ls -1 "$CACHE_DIR" 2>/dev/null | wc -l | tr -d ' ')
    printf "  %-25s %10s\n" "Cache size:" "$FINAL_CACHE_SIZE"
    printf "  %-25s %10s\n" "Cached repositories:" "$FINAL_CACHE_COUNT"
fi

echo -e "\n${GREEN}${BOLD}✓ Benchmark complete!${NC}"
