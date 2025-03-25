# Pre-Receive Hook Documentation

## Overview

The `pre-receive` hook is a critical component of the Git Proxy system. It is executed before changes are accepted into a repository. This hook allows for custom logic to validate or reject incoming changes based on specific criteria, ensuring that only valid and authorized changes are pushed to the repository.

## Functionality

The `pre-receive` hook determines the outcome of a push based on the exit status of the hook script:

- If the script exits with status `0`, the push is automatically approved.
- If the script exits with status `1`, the push is automatically rejected.
- If the script exits with status `2`, the push requires manual approval.
- Any other exit status is treated as an error, and the push is rejected with an appropriate error message.

## Usage

To use the `pre-receive` hook, follow these steps:

- **Create a Hook Script**:  
  Write a shell script or executable file that implements your custom validation logic. The script must accept input in the format: `<old_commit_hash> <new_commit_hash> <branch_name>`.

- **Place the Script**:  
  Save the script in the appropriate directory, such as `hooks/pre-receive.sh`.

- **Make the Script Executable**:  
  Ensure the script has executable permissions. You can do this by running the following command:

  ```bash
  chmod +x hooks/pre-receive.sh
  ```

> **Note**: If the `pre-receive` script does not exist, the hook will not be executed, and the push will proceed without validation.

## Example Hook Script

Below is an example of a simple `pre-receive` hook script:

```bash
#!/bin/bash

read old_commit new_commit branch_name

# Example validation: Reject pushes to the main branch
if [ "$branch_name" == "main" ]; then
  echo "Pushes to the main branch are not allowed."
  exit 1
fi

# Approve all other pushes
exit 0
```
