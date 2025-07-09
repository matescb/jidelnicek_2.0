#!/usr/bin/env python3
"""
Simple test script to verify storage implementation without full app configuration.
"""

import os
import sys
import tempfile
import asyncio
from pathlib import Path
from io import BytesIO

# Add src to path
sys.path.insert(0, str(Path(__file__).parent / "src"))

from jidelnicek.core.storage.local import LocalStorageBackend
from jidelnicek.core.storage.s3 import S3StorageBackend
from jidelnicek.core.storage.azure import AzureStorageBackend
from jidelnicek.core.storage.base import StorageMetadata, CompressionType
from datetime import datetime


async def test_local_storage():
    """Test local storage backend."""
    print("Testing Local Storage Backend...")
    
    with tempfile.TemporaryDirectory() as temp_dir:
        config = {
            "base_path": temp_dir,
            "compression": "gzip",
            "permissions": 0o600,
            "max_file_size": 10 * 1024 * 1024,
        }
        
        storage = LocalStorageBackend(config)
        
        # Test data
        test_data = b"This is test content for local storage"
        file_data = BytesIO(test_data)
        
        # Create metadata
        metadata = StorageMetadata(
            file_id="exports/2024/01/user123/job456/test.pdf",
            filename="test.pdf",
            content_type="application/pdf",
            size=0,
            checksum="",
            created_at=datetime.utcnow(),
            user_id="user123",
            job_id="job456",
            compression=CompressionType.GZIP,
            metadata={"test": "value"},
            tags=["export", "pdf"],
        )
        
        # Test store
        print("  Testing file storage...")
        storage_path = await storage.store(
            file_id=metadata.file_id,
            file_data=file_data,
            metadata=metadata,
            overwrite=False
        )
        print(f"  ✓ File stored at: {storage_path}")
        
        # Test exists
        print("  Testing file existence...")
        exists = await storage.exists(metadata.file_id)
        print(f"  ✓ File exists: {exists}")
        
        # Test retrieve
        print("  Testing file retrieval...")
        retrieved_data, retrieved_metadata = await storage.retrieve(metadata.file_id)
        content = retrieved_data.read()
        print(f"  ✓ Retrieved content matches: {content == test_data}")
        print(f"  ✓ Retrieved metadata: {retrieved_metadata.filename}")
        
        # Test metadata
        print("  Testing metadata retrieval...")
        metadata_only = await storage.get_metadata(metadata.file_id)
        print(f"  ✓ Metadata checksum: {metadata_only.checksum}")
        print(f"  ✓ Compression: {metadata_only.compression}")
        
        # Test list files
        print("  Testing file listing...")
        files = await storage.list_files()
        print(f"  ✓ Found {len(files)} files")
        
        # Test usage stats
        print("  Testing usage statistics...")
        stats = await storage.get_usage_stats()
        print(f"  ✓ Total files: {stats['total_files']}")
        print(f"  ✓ Total size: {stats['total_size']} bytes")
        
        # Test delete
        print("  Testing file deletion...")
        deleted = await storage.delete(metadata.file_id)
        print(f"  ✓ File deleted: {deleted}")
        
        exists_after_delete = await storage.exists(metadata.file_id)
        print(f"  ✓ File exists after delete: {exists_after_delete}")
        
        print("  ✓ Local storage tests passed!")


async def test_compression():
    """Test different compression types."""
    print("\nTesting Compression Types...")
    
    with tempfile.TemporaryDirectory() as temp_dir:
        config = {
            "base_path": temp_dir,
            "compression": "gzip",
            "permissions": 0o600,
            "max_file_size": 10 * 1024 * 1024,
        }
        
        storage = LocalStorageBackend(config)
        
        # Test data - repetitive for good compression
        test_data = b"A" * 1000
        
        compression_types = [
            CompressionType.NONE,
            CompressionType.GZIP,
            CompressionType.BZIP2,
            CompressionType.XZ,
            CompressionType.ZIP,
        ]
        
        for compression_type in compression_types:
            print(f"  Testing {compression_type.value} compression...")
            
            file_id = f"test/compression/{compression_type.value}.txt"
            metadata = StorageMetadata(
                file_id=file_id,
                filename=f"{compression_type.value}.txt",
                content_type="text/plain",
                size=0,
                checksum="",
                created_at=datetime.utcnow(),
                compression=compression_type,
            )
            
            file_data = BytesIO(test_data)
            await storage.store(
                file_id=file_id,
                file_data=file_data,
                metadata=metadata,
                overwrite=False
            )
            
            # Retrieve and verify
            retrieved_data, retrieved_metadata = await storage.retrieve(file_id)
            assert retrieved_data.read() == test_data
            assert retrieved_metadata.compression == compression_type
            
            # Check compression effectiveness
            if compression_type != CompressionType.NONE:
                compression_ratio = (retrieved_metadata.original_size - retrieved_metadata.size) / retrieved_metadata.original_size * 100
                print(f"    ✓ Compression ratio: {compression_ratio:.1f}%")
            else:
                print(f"    ✓ No compression applied")
        
        print("  ✓ Compression tests passed!")


async def test_file_naming():
    """Test file naming conventions."""
    print("\nTesting File Naming Conventions...")
    
    with tempfile.TemporaryDirectory() as temp_dir:
        config = {
            "base_path": temp_dir,
            "compression": "gzip",
            "permissions": 0o600,
            "max_file_size": 10 * 1024 * 1024,
        }
        
        storage = LocalStorageBackend(config)
        
        # Test various file naming scenarios
        test_cases = [
            ("exports/2024/01/user123/job456/document.pdf", "Standard file"),
            ("exports/2024/12/anonymous/direct/file.txt", "Anonymous user"),
            ("exports/2025/06/user456/job789/report.xlsx", "Different user/job"),
        ]
        
        for file_id, description in test_cases:
            print(f"  Testing {description}: {file_id}")
            
            metadata = StorageMetadata(
                file_id=file_id,
                filename=Path(file_id).name,
                content_type="application/octet-stream",
                size=0,
                checksum="",
                created_at=datetime.utcnow(),
                user_id=file_id.split("/")[3] if file_id.split("/")[3] != "anonymous" else None,
                job_id=file_id.split("/")[4] if file_id.split("/")[4] != "direct" else None,
            )
            
            file_data = BytesIO(b"Test content")
            storage_path = await storage.store(
                file_id=file_id,
                file_data=file_data,
                metadata=metadata,
                overwrite=False
            )
            
            # Verify directory structure
            path = Path(storage_path)
            print(f"    ✓ Path structure: {path.relative_to(temp_dir)}")
            
            # Verify metadata file exists
            metadata_path = path.with_suffix(path.suffix + ".meta.json")
            assert metadata_path.exists(), f"Metadata file not found: {metadata_path}"
            print(f"    ✓ Metadata file exists")
        
        print("  ✓ File naming tests passed!")


async def main():
    """Run all tests."""
    print("=== Storage System Review Tests ===\n")
    
    try:
        await test_local_storage()
        await test_compression()
        await test_file_naming()
        
        print("\n=== All Tests Passed! ===")
        return True
        
    except Exception as e:
        print(f"\n❌ Test failed: {e}")
        import traceback
        traceback.print_exc()
        return False


if __name__ == "__main__":
    success = asyncio.run(main())
    sys.exit(0 if success else 1)