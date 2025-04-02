#!/bin/bash
while read oldrev newrev refname; do
  echo "Push allowed to $refname"
done
exit 0