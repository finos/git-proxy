#!/usr/bin/env python3
"""
Extract PACK data from a captured git receive-pack request.

The request body contains:
1. Pkt-line formatted ref update commands
2. A flush packet (0000)
3. The PACK file (starts with "PACK")

This script extracts just the PACK portion for use with git commands.
"""

import sys
import os

def extract_pack(request_file, output_file):
    """Extract PACK data from a captured request file."""
    if not os.path.exists(request_file):
        print(f"Error: File not found: {request_file}")
        sys.exit(1)
    
    with open(request_file, 'rb') as f:
        data = f.read()
    
    # Find PACK signature (0x5041434b)
    pack_start = data.find(b'PACK')
    if pack_start == -1:
        print("No PACK data found in request")
        print(f"File size: {len(data)} bytes")
        print(f"First 100 bytes (hex): {data[:100].hex()}")
        sys.exit(1)
    
    pack_data = data[pack_start:]
    
    # Verify PACK header
    if len(pack_data) < 12:
        print("PACK data too short (less than 12 bytes)")
        sys.exit(1)
    
    signature = pack_data[0:4]
    version = int.from_bytes(pack_data[4:8], byteorder='big')
    num_objects = int.from_bytes(pack_data[8:12], byteorder='big')
    
    print(f"Found PACK data at offset {pack_start}")
    print(f"PACK signature: {signature}")
    print(f"PACK version: {version}")
    print(f"Number of objects: {num_objects}")
    print(f"PACK size: {len(pack_data)} bytes")
    
    with open(output_file, 'wb') as f:
        f.write(pack_data)
    
    print(f"\nExtracted PACK data to: {output_file}")
    print(f"\nYou can now use git commands:")
    print(f"  git index-pack {output_file}")
    print(f"  git verify-pack -v {output_file}")

def main():
    if len(sys.argv) != 3:
        print("Usage: extract-pack.py <request.bin> <output.pack>")
        print("\nExample:")
        print("  ./extract-pack.py captured-data/20250101-120000-receive-pack-test-repo.request.bin output.pack")
        sys.exit(1)
    
    request_file = sys.argv[1]
    output_file = sys.argv[2]
    
    extract_pack(request_file, output_file)

if __name__ == "__main__":
    main()
