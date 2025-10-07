#!/usr/bin/env python3
"""
CGI wrapper for git-http-backend that captures raw HTTP request/response data.
This wrapper intercepts git operations and saves the binary data to files for testing.
"""

import os
import sys
import subprocess
import time
from datetime import datetime

# Configuration
CAPTURE_DIR = "/var/git-captures"
GIT_HTTP_BACKEND = "/usr/lib/git-core/git-http-backend"
ENABLE_CAPTURE = os.environ.get("GIT_CAPTURE_ENABLE", "1") == "1"

def ensure_capture_dir():
    """Ensure the capture directory exists."""
    if not os.path.exists(CAPTURE_DIR):
        os.makedirs(CAPTURE_DIR, mode=0o755)

def get_capture_filename(service_name, repo_path):
    """Generate a unique filename for the capture."""
    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S-%f")
    # Clean up repo path: remove leading slash, replace slashes with dashes, remove .git
    repo_safe = repo_path.lstrip("/").replace("/", "-").replace(".git", "")
    return f"{timestamp}-{service_name}-{repo_safe}"

def capture_request_data(stdin_data, metadata):
    """Save request data and metadata to files."""
    if not ENABLE_CAPTURE:
        return
    
    ensure_capture_dir()
    
    # Determine service type from PATH_INFO or QUERY_STRING
    path_info = os.environ.get("PATH_INFO", "")
    query_string = os.environ.get("QUERY_STRING", "")
    request_method = os.environ.get("REQUEST_METHOD", "")
    
    service_name = "unknown"
    if "git-receive-pack" in path_info or "git-receive-pack" in query_string:
        service_name = "receive-pack"
    elif "git-upload-pack" in path_info or "git-upload-pack" in query_string:
        service_name = "upload-pack"
    
    # Only capture POST requests (actual push/fetch data)
    if request_method != "POST":
        return None
    
    repo_path = path_info.split("/git-")[0] if "/git-" in path_info else path_info
    base_filename = get_capture_filename(service_name, repo_path)
    
    # Save request body (binary data)
    request_file = os.path.join(CAPTURE_DIR, f"{base_filename}.request.bin")
    with open(request_file, "wb") as f:
        f.write(stdin_data)
    
    # Save metadata
    metadata_file = os.path.join(CAPTURE_DIR, f"{base_filename}.metadata.txt")
    with open(metadata_file, "w") as f:
        f.write(f"Timestamp: {datetime.now().isoformat()}\n")
        f.write(f"Service: {service_name}\n")
        f.write(f"Request Method: {request_method}\n")
        f.write(f"Path Info: {path_info}\n")
        f.write(f"Query String: {query_string}\n")
        f.write(f"Content Type: {os.environ.get('CONTENT_TYPE', '')}\n")
        f.write(f"Content Length: {os.environ.get('CONTENT_LENGTH', '')}\n")
        f.write(f"Remote Addr: {os.environ.get('REMOTE_ADDR', '')}\n")
        f.write(f"HTTP User Agent: {os.environ.get('HTTP_USER_AGENT', '')}\n")
        f.write(f"\nRequest Body Size: {len(stdin_data)} bytes\n")
        f.write(f"Request File: {request_file}\n")
    
    return base_filename

def main():
    """Main wrapper function."""
    # Read stdin (request body) into memory
    content_length = int(os.environ.get("CONTENT_LENGTH", "0"))
    stdin_data = sys.stdin.buffer.read(content_length) if content_length > 0 else b""
    
    # Capture request data
    metadata = {}
    base_filename = capture_request_data(stdin_data, metadata)
    
    # Prepare environment for git-http-backend
    env = os.environ.copy()
    
    # Execute git-http-backend
    process = subprocess.Popen(
        [GIT_HTTP_BACKEND],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        env=env
    )
    
    # Send the captured stdin to git-http-backend
    stdout_data, stderr_data = process.communicate(input=stdin_data)
    
    # Capture response data
    if ENABLE_CAPTURE and base_filename:
        response_file = os.path.join(CAPTURE_DIR, f"{base_filename}.response.bin")
        with open(response_file, "wb") as f:
            f.write(stdout_data)
        
        # Update metadata with response info
        metadata_file = os.path.join(CAPTURE_DIR, f"{base_filename}.metadata.txt")
        with open(metadata_file, "a") as f:
            f.write(f"Response File: {response_file}\n")
            f.write(f"Response Size: {len(stdout_data)} bytes\n")
            f.write(f"Exit Code: {process.returncode}\n")
            if stderr_data:
                f.write(f"\nStderr:\n{stderr_data.decode('utf-8', errors='replace')}\n")
    
    # Write response to stdout
    sys.stdout.buffer.write(stdout_data)
    
    # Write stderr if any
    if stderr_data:
        sys.stderr.buffer.write(stderr_data)
    
    # Exit with the same code as git-http-backend
    sys.exit(process.returncode)

if __name__ == "__main__":
    main()
