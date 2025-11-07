#!/bin/bash
set -e  # Exit on any error

# Create the git repositories directories for multiple owners
BASE_DIR="${BASE_DIR:-"/var/git"}"
OWNERS=("coopernetes" "finos")
TEMP_DIR="/tmp/git-init"

# Create base directory and owner subdirectories
mkdir -p "$BASE_DIR"
mkdir -p "$TEMP_DIR"

for owner in "${OWNERS[@]}"; do
    mkdir -p "$BASE_DIR/$owner"
done

echo "Creating git repositories in $BASE_DIR for owners: ${OWNERS[*]}"

# Set git configuration for commits
export GIT_AUTHOR_NAME="Git Server"
export GIT_AUTHOR_EMAIL="git@example.com"
export GIT_COMMITTER_NAME="Git Server"
export GIT_COMMITTER_EMAIL="git@example.com"

# Function to create a bare repository in a specific owner directory
create_bare_repo() {
    local owner="$1"
    local repo_name="$2"
    local repo_dir="$BASE_DIR/$owner"
    
    echo "Creating $repo_name in $owner's directory..."
    cd "$repo_dir" || exit 1
    git init --bare --initial-branch=main "$repo_name"
    
    # Configure for HTTP access
    cd "$repo_dir/$repo_name" || exit 1
    git config http.receivepack true
    git config http.uploadpack true
    # Set HEAD to point to main branch
    git symbolic-ref HEAD refs/heads/main
    cd "$repo_dir" || exit 1
}

# Function to add content to a repository
add_content_to_repo() {
    local owner="$1"
    local repo_name="$2"
    local repo_path="$BASE_DIR/$owner/$repo_name"
    local work_dir="$TEMP_DIR/${owner}-${repo_name%-.*}-work"
    
    echo "Adding content to $owner/$repo_name..."
    cd "$TEMP_DIR" || exit 1
    git clone "$repo_path" "$work_dir"
    cd "$work_dir" || exit 1
}

# Create repositories with simple content
echo "=== Creating coopernetes/test-repo.git ==="
create_bare_repo "coopernetes" "test-repo.git"
add_content_to_repo "coopernetes" "test-repo.git"

# Create a simple README
cat > README.md << 'EOF'
# Test Repository

This is a test repository for the git proxy, simulating coopernetes/test-repo.
EOF

# Create a simple text file
cat > hello.txt << 'EOF'
Hello World from test-repo!
EOF

git add .
git commit -m "Initial commit with basic content"
git push origin main

echo "=== Creating finos/git-proxy.git ==="
create_bare_repo "finos" "git-proxy.git"
add_content_to_repo "finos" "git-proxy.git"

# Create a simple README
cat > README.md << 'EOF'
# Git Proxy

This is a test instance of the FINOS Git Proxy project for isolated e2e testing.
EOF

# Create a simple package.json to simulate the real project structure
cat > package.json << 'EOF'
{
  "name": "git-proxy",
  "version": "1.0.0",
  "description": "A proxy for Git operations",
  "main": "index.js",
  "scripts": {
    "test": "echo \"Error: no test specified\" && exit 1"
  },
  "keywords": ["git", "proxy", "finos"],
  "author": "FINOS",
  "license": "Apache-2.0"
}
EOF

# Create a simple LICENSE file
cat > LICENSE << 'EOF'
                                 Apache License
                           Version 2.0, January 2004
                        http://www.apache.org/licenses/

   SPDX-License-Identifier: Apache-2.0
EOF

git add .
git commit -m "Initial commit with project structure"
git push origin main

echo "=== Repository creation complete ==="
# No copying needed since we're creating specific repos for specific owners

# Clean up temporary directory
echo "Cleaning up temporary files..."
rm -rf "$TEMP_DIR"

echo "=== Repository Summary ==="
for owner in "${OWNERS[@]}"; do
    echo "Owner: $owner"
    ls -la "$BASE_DIR/$owner"
    echo ""
done

# Set proper ownership (only if www-data user exists)
if id www-data >/dev/null 2>&1; then
    echo "Setting ownership to www-data..."
    chown -R www-data:www-data "$BASE_DIR"
else
    echo "www-data user not found, skipping ownership change"
fi

echo "=== Final repository listing with permissions ==="
for owner in "${OWNERS[@]}"; do
    echo "Owner: $owner ($BASE_DIR/$owner)"
    ls -la "$BASE_DIR/$owner"
    echo ""
done

echo "Successfully initialized Git repositories in $BASE_DIR"
echo "Owners created: ${OWNERS[*]}"
echo "Total repositories: $(find $BASE_DIR -name "*.git" -type d | wc -l)"