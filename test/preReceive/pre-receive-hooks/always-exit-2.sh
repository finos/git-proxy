#!/bin/bash
while read oldrev newrev refname; do
  echo "Push need manual approve to $refname"
done
exit 2