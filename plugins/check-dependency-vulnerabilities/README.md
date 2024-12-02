

Plugin that checks if any vulnerable dependency is used in a git repo. Uses OWASP's dependency-check to achieve this.
The filtering strictness of the plugin can be decided by the user by using the "dependencyVulnThreshold" key in config JSON. "dependencyVulnThreshold" decides the lower bound to the filtering. So, if "dependencyVulnThreshold" is "LOW", any vulnerabilities of level LOW or higher would block the push. Allowed values for dependencyVulnThreshold are info, low, medium, high, critical

Check this link to see the languages/file-types supported by dependency check
https://jeremylong.github.io/DependencyCheck/analyzers/index.html

## Pre Requisites
This plugin expects dependency-check to be installed and in the path environment variable
Command `dependency-check --updateonly` has to be run once in the terminal after dependency-check installation

## Limitations
dependency-check is using an argument --noupdate to avoid the execution time overhead(~20-30 minutes), which comes with automatic updation of NVD (National Vulnerability Database). This means user has to manually run the update command atleast once during the initial set-up and later whenever user wants to use the latest data. 

