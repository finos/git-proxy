#!/bin/bash
while read oldrev newrev refname; do
  echo "Push rejected to $refname"
done
exit 1