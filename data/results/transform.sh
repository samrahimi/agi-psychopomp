#!/bin/bash

# Check if an argument is provided
if [ $# -ne 1 ]; then
    echo "Usage: $0 '[1,2],[3,4],[5,6]'"
    exit 1
fi

# Remove all spaces from input
input=$(echo "$1" | tr -d ' ')

# Extract numbers into an array
numbers=($(echo "$input" | tr -d '[]' | tr ',' ' '))

# Calculate dimensions
rows=$(echo "$input" | tr -d '][' | grep -o ',' | wc -l)
((rows++))
cols=$((${#numbers[@]} / rows))

# Create transposed matrix
result="["
for ((i=0; i<cols; i++)); do
    if [ $i -ne 0 ]; then
        result+="],["
    fi
    for ((j=0; j<rows; j++)); do
        if [ $j -ne 0 ]; then
            result+=","
        fi
        index=$((j * cols + i))
        result+="${numbers[$index]}"
    done
done
result+="]"

echo "$result"
