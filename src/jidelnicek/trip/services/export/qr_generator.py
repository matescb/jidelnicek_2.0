"""QR Code generator for trip exports and sharing."""

import base64
import gzip
import json
import logging
from enum import Enum
from io import BytesIO
from typing import Any, Dict, Optional, Tuple, Union

from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)


class QRErrorCorrection(str, Enum):
    """QR code error correction levels."""

    LOW = "L"  # ~7% correction
    MEDIUM = "M"  # ~15% correction
    QUARTILE = "Q"  # ~25% correction
    HIGH = "H"  # ~30% correction


class QRCodeConfig(BaseModel):
    """Configuration for QR code generation."""

    size: int = Field(default=10, ge=1, le=40, description="QR code version/size")
    border: int = Field(default=4, ge=1, description="Border size in modules")
    error_correction: QRErrorCorrection = Field(
        default=QRErrorCorrection.MEDIUM,
        description="Error correction level",
    )
    fill_color: str = Field(default="black", description="Fill color")
    back_color: str = Field(default="white", description="Background color")
    image_format: str = Field(default="PNG", description="Output image format")


class QRCodeData(BaseModel):
    """Data to be encoded in QR code."""

    type: str = Field(description="Type of data (url, json, text)")
    content: Union[str, Dict[str, Any]] = Field(description="Content to encode")
    compress: bool = Field(default=False, description="Whether to compress data")


class QRCodeGenerator:
    """Generator for QR codes with support for various data types."""

    def __init__(self, config: Optional[QRCodeConfig] = None):
        """Initialize QR code generator."""
        self.config = config or QRCodeConfig()
        self._qrcode_available = self._check_qrcode_available()

    def _check_qrcode_available(self) -> bool:
        """Check if qrcode library is available."""
        try:
            import qrcode  # noqa: F401

            return True
        except ImportError:
            logger.warning(
                "qrcode library not installed. QR code generation will be unavailable. "
                "Install with: pip install jidelnicek[qr]"
            )
            return False

    def generate(self, data: QRCodeData) -> Optional[bytes]:
        """
        Generate QR code from data.

        Args:
            data: Data to encode in QR code

        Returns:
            Bytes of the generated QR code image or None if generation fails
        """
        if not self._qrcode_available:
            logger.error("Cannot generate QR code: qrcode library not installed")
            return None

        try:
            import qrcode
            from PIL import Image

            # Prepare data for encoding
            encoded_data = self._prepare_data(data)
            if not encoded_data:
                return None

            # Create QR code
            qr = qrcode.QRCode(
                version=self.config.size,
                error_correction=self._get_error_correction_constant(),
                box_size=10,
                border=self.config.border,
            )

            qr.add_data(encoded_data)
            qr.make(fit=True)

            # Create image
            img = qr.make_image(
                fill_color=self.config.fill_color,
                back_color=self.config.back_color,
            )

            # Convert to bytes
            buffer = BytesIO()
            img.save(buffer, format=self.config.image_format)
            return buffer.getvalue()

        except Exception as e:
            logger.error(f"Failed to generate QR code: {e}")
            return None

    def generate_base64(self, data: QRCodeData) -> Optional[str]:
        """
        Generate QR code and return as base64 string.

        Args:
            data: Data to encode in QR code

        Returns:
            Base64 encoded string of the QR code image or None if generation fails
        """
        qr_bytes = self.generate(data)
        if qr_bytes:
            return base64.b64encode(qr_bytes).decode("utf-8")
        return None

    def generate_trip_share_qr(self, trip_id: str, base_url: str) -> Optional[bytes]:
        """
        Generate QR code for trip sharing link.

        Args:
            trip_id: Trip identifier
            base_url: Base URL for the application

        Returns:
            QR code image bytes
        """
        share_url = f"{base_url}/trips/{trip_id}/share"
        data = QRCodeData(type="url", content=share_url)
        return self.generate(data)

    def generate_shopping_list_qr(self, shopping_list: Dict[str, Any]) -> Optional[bytes]:
        """
        Generate QR code for shopping list data.

        Args:
            shopping_list: Shopping list data

        Returns:
            QR code image bytes
        """
        # For large shopping lists, compress the data
        data = QRCodeData(
            type="json",
            content=shopping_list,
            compress=True,  # Enable compression for shopping lists
        )
        return self.generate(data)

    def generate_recipe_qr(self, recipe_id: str, base_url: str) -> Optional[bytes]:
        """
        Generate QR code for recipe link.

        Args:
            recipe_id: Recipe identifier
            base_url: Base URL for the application

        Returns:
            QR code image bytes
        """
        recipe_url = f"{base_url}/recipes/{recipe_id}"
        data = QRCodeData(type="url", content=recipe_url)
        return self.generate(data)

    def generate_export_download_qr(self, export_id: str, base_url: str) -> Optional[bytes]:
        """
        Generate QR code for export download link.

        Args:
            export_id: Export identifier
            base_url: Base URL for the application

        Returns:
            QR code image bytes
        """
        download_url = f"{base_url}/exports/{export_id}/download"
        data = QRCodeData(type="url", content=download_url)
        return self.generate(data)

    def _prepare_data(self, data: QRCodeData) -> Optional[str]:
        """
        Prepare data for QR code encoding.

        Args:
            data: Data to prepare

        Returns:
            Encoded string ready for QR code generation
        """
        try:
            if data.type == "url" or data.type == "text":
                return str(data.content)

            elif data.type == "json":
                json_str = json.dumps(data.content, separators=(",", ":"))

                if data.compress:
                    # Compress JSON data
                    compressed = gzip.compress(json_str.encode("utf-8"))
                    # Encode as base64 for QR code
                    return f"gzip:{base64.b64encode(compressed).decode('ascii')}"
                else:
                    return json_str

            else:
                logger.error(f"Unsupported data type: {data.type}")
                return None

        except Exception as e:
            logger.error(f"Failed to prepare data for QR code: {e}")
            return None

    def _get_error_correction_constant(self) -> Any:
        """Get qrcode library error correction constant."""
        import qrcode

        mapping = {
            QRErrorCorrection.LOW: qrcode.constants.ERROR_CORRECT_L,
            QRErrorCorrection.MEDIUM: qrcode.constants.ERROR_CORRECT_M,
            QRErrorCorrection.QUARTILE: qrcode.constants.ERROR_CORRECT_Q,
            QRErrorCorrection.HIGH: qrcode.constants.ERROR_CORRECT_H,
        }
        return mapping[self.config.error_correction]

    def estimate_data_size(self, data: QRCodeData) -> Tuple[int, bool]:
        """
        Estimate the size of data after encoding.

        Args:
            data: Data to estimate

        Returns:
            Tuple of (size in bytes, fits in QR code)
        """
        encoded = self._prepare_data(data)
        if not encoded:
            return 0, False

        size = len(encoded.encode("utf-8"))

        # QR code capacity varies by version and error correction
        # This is a simplified check - actual capacity depends on data type
        max_capacity = {
            QRErrorCorrection.LOW: 2953,
            QRErrorCorrection.MEDIUM: 2331,
            QRErrorCorrection.QUARTILE: 1663,
            QRErrorCorrection.HIGH: 1273,
        }

        fits = size <= max_capacity[self.config.error_correction]
        return size, fits

    def generate_with_logo(
        self,
        data: QRCodeData,
        logo_path: str,
        logo_size_ratio: float = 0.3,
    ) -> Optional[bytes]:
        """
        Generate QR code with embedded logo.

        Args:
            data: Data to encode
            logo_path: Path to logo image
            logo_size_ratio: Ratio of logo size to QR code size (0.0-0.5)

        Returns:
            QR code image bytes with logo
        """
        if not self._qrcode_available:
            logger.error("Cannot generate QR code: qrcode library not installed")
            return None

        try:
            import qrcode
            from PIL import Image

            # Generate base QR code
            qr_bytes = self.generate(data)
            if not qr_bytes:
                return None

            # Open QR code and logo images
            qr_img = Image.open(BytesIO(qr_bytes))
            logo_img = Image.open(logo_path)

            # Calculate logo size
            qr_width, qr_height = qr_img.size
            logo_size = int(min(qr_width, qr_height) * logo_size_ratio)

            # Resize logo
            logo_img = logo_img.resize(
                (logo_size, logo_size),
                Image.Resampling.LANCZOS,
            )

            # Create white background for logo
            logo_bg = Image.new("RGB", (logo_size + 20, logo_size + 20), "white")
            logo_bg.paste(
                logo_img,
                ((logo_bg.size[0] - logo_size) // 2, (logo_bg.size[1] - logo_size) // 2),
            )

            # Paste logo onto QR code
            logo_pos = (
                (qr_width - logo_bg.size[0]) // 2,
                (qr_height - logo_bg.size[1]) // 2,
            )
            qr_img.paste(logo_bg, logo_pos)

            # Convert to bytes
            buffer = BytesIO()
            qr_img.save(buffer, format=self.config.image_format)
            return buffer.getvalue()

        except Exception as e:
            logger.error(f"Failed to generate QR code with logo: {e}")
            return None


# Convenience functions for quick QR code generation
def generate_qr_code(
    content: Union[str, Dict[str, Any]],
    compress: bool = False,
    config: Optional[QRCodeConfig] = None,
) -> Optional[bytes]:
    """
    Quick function to generate QR code.

    Args:
        content: Content to encode
        compress: Whether to compress JSON data
        config: Optional QR code configuration

    Returns:
        QR code image bytes
    """
    generator = QRCodeGenerator(config)

    # Determine data type
    if isinstance(content, str):
        if content.startswith(("http://", "https://")):
            data_type = "url"
        else:
            data_type = "text"
    else:
        data_type = "json"

    data = QRCodeData(type=data_type, content=content, compress=compress)
    return generator.generate(data)


def generate_qr_code_base64(
    content: Union[str, Dict[str, Any]],
    compress: bool = False,
    config: Optional[QRCodeConfig] = None,
) -> Optional[str]:
    """
    Quick function to generate base64 encoded QR code.

    Args:
        content: Content to encode
        compress: Whether to compress JSON data
        config: Optional QR code configuration

    Returns:
        Base64 encoded QR code image
    """
    qr_bytes = generate_qr_code(content, compress, config)
    if qr_bytes:
        return base64.b64encode(qr_bytes).decode("utf-8")
    return None