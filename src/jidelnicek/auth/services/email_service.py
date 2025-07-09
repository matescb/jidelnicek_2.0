"""
Email service for Jidelnicek 2.0 authentication system.

This module provides email functionality for:
- Email verification
- Password reset
- Account notifications
- Security alerts
"""

import logging
from typing import Optional, Dict, Any
from datetime import datetime
import asyncio

from jidelnicek.core.config import settings

logger = logging.getLogger(__name__)


class EmailService:
    """
    Service for sending authentication-related emails.
    
    Currently implements mock email sending with console logging.
    To be replaced with actual email provider integration.
    """
    
    def __init__(self):
        """Initialize email service."""
        self.from_email = settings.email_from
        self.from_name = settings.email_from_name
        self.base_url = self._get_base_url()
        
    def _get_base_url(self) -> str:
        """Get base URL for email links."""
        # In production, this would come from settings
        if settings.is_production:
            return "https://jidelnicek.cz"
        return "http://localhost:3000"
    
    async def send_verification_email(
        self,
        to_email: str,
        verification_token: str,
        language: str = "cs"
    ) -> bool:
        """
        Send email verification message.
        
        Args:
            to_email: Recipient email address
            verification_token: Email verification token
            language: User's preferred language (cs/en)
            
        Returns:
            True if email was sent successfully
        """
        verification_url = f"{self.base_url}/verify-email?token={verification_token}"
        
        # Choose language-specific content
        if language == "en":
            subject = "Verify your Jídelníček 2.0 account"
            template_data = {
                "title": "Email Verification",
                "greeting": "Welcome to Jídelníček 2.0!",
                "message": "Please verify your email address by clicking the link below:",
                "button_text": "Verify Email",
                "expires_text": "This link will expire in 24 hours.",
                "footer": "If you didn't create an account, please ignore this email.",
                "trouble_text": "Having trouble? Copy and paste this link into your browser:",
                "thank_you": "Thank you for joining Jídelníček 2.0!"
            }
        else:  # Czech (default)
            subject = "Ověřte svůj účet Jídelníček 2.0"
            template_data = {
                "title": "Ověření e-mailu",
                "greeting": "Vítejte v aplikaci Jídelníček 2.0!",
                "message": "Prosím ověřte svou e-mailovou adresu kliknutím na odkaz níže:",
                "button_text": "Ověřit e-mail",
                "expires_text": "Tento odkaz vyprší za 24 hodin.",
                "footer": "Pokud jste si účet nevytvořili, tento e-mail prosím ignorujte.",
                "trouble_text": "Máte problémy? Zkopírujte a vložte tento odkaz do prohlížeče:",
                "thank_you": "Děkujeme za registraci do aplikace Jídelníček 2.0!"
            }
        
        # Generate HTML email content
        html_content = self._generate_email_html(
            title=template_data["title"],
            content=f"""
                <h2 style="color: #333; margin-bottom: 20px;">{template_data["greeting"]}</h2>
                <p style="color: #666; margin-bottom: 30px;">{template_data["message"]}</p>
                
                <div style="text-align: center; margin: 40px 0;">
                    <a href="{verification_url}" 
                       style="background-color: #4CAF50; color: white; padding: 15px 30px; 
                              text-decoration: none; border-radius: 5px; display: inline-block;
                              font-weight: bold; font-size: 16px;">
                        {template_data["button_text"]}
                    </a>
                </div>
                
                <p style="color: #999; font-size: 14px; margin: 30px 0;">
                    <strong>{template_data["expires_text"]}</strong>
                </p>
                
                <p style="color: #666; margin-bottom: 20px;">{template_data["thank_you"]}</p>
                
                <hr style="border: none; border-top: 1px solid #eee; margin: 40px 0;">
                
                <p style="color: #999; font-size: 12px; margin-bottom: 10px;">
                    {template_data["trouble_text"]}
                </p>
                <p style="color: #999; font-size: 12px; word-break: break-all;">
                    {verification_url}
                </p>
                
                <hr style="border: none; border-top: 1px solid #eee; margin: 40px 0;">
                
                <p style="color: #999; font-size: 12px; text-align: center;">
                    {template_data["footer"]}
                </p>
            """
        )
        
        # Mock email sending - log to console
        logger.info(
            f"📧 MOCK EMAIL SENT\n"
            f"To: {to_email}\n"
            f"Subject: {subject}\n"
            f"Verification URL: {verification_url}\n"
            f"Language: {language}\n"
            f"HTML Preview: [HTML email with verification button and link]"
        )
        
        # In production, this would use an actual email service
        # Example: AWS SES, SendGrid, Mailgun, etc.
        # The HTML content would be sent as the email body
        
        # Simulate async operation
        await asyncio.sleep(0.1)
        
        return True
    
    def _generate_email_html(self, title: str, content: str) -> str:
        """
        Generate HTML email template.
        
        Args:
            title: Email title
            content: Email content (HTML)
            
        Returns:
            Complete HTML email
        """
        return f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>{title}</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
            <table cellpadding="0" cellspacing="0" width="100%" style="background-color: #f4f4f4;">
                <tr>
                    <td align="center" style="padding: 40px 0;">
                        <table cellpadding="0" cellspacing="0" width="600" style="background-color: white; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                            <tr>
                                <td style="padding: 40px 40px 20px 40px; text-align: center;">
                                    <h1 style="color: #4CAF50; margin: 0; font-size: 28px;">Jídelníček 2.0</h1>
                                </td>
                            </tr>
                            <tr>
                                <td style="padding: 20px 40px 40px 40px;">
                                    {content}
                                </td>
                            </tr>
                        </table>
                    </td>
                </tr>
            </table>
        </body>
        </html>
        """
    
    async def send_password_reset_email(
        self,
        to_email: str,
        reset_token: str,
        language: str = "cs"
    ) -> bool:
        """
        Send password reset email.
        
        Args:
            to_email: Recipient email address
            reset_token: Password reset token
            language: User's preferred language (cs/en)
            
        Returns:
            True if email was sent successfully
        """
        reset_url = f"{self.base_url}/reset-password?token={reset_token}"
        
        # Choose language-specific content
        if language == "en":
            subject = "Reset your Jídelníček 2.0 password"
            template_data = {
                "title": "Password Reset",
                "greeting": "Password Reset Request",
                "message": "You requested to reset your password. Click the link below to continue:",
                "button_text": "Reset Password",
                "expires_text": "This link will expire in 1 hour.",
                "footer": "If you didn't request this, please ignore this email.",
                "security_note": "For security reasons, all your active sessions will be logged out after resetting your password.",
                "trouble_text": "Having trouble? Copy and paste this link into your browser:"
            }
        else:  # Czech (default)
            subject = "Obnovení hesla pro Jídelníček 2.0"
            template_data = {
                "title": "Obnovení hesla",
                "greeting": "Žádost o obnovení hesla",
                "message": "Požádali jste o obnovení hesla. Klikněte na odkaz níže pro pokračování:",
                "button_text": "Obnovit heslo",
                "expires_text": "Tento odkaz vyprší za 1 hodinu.",
                "footer": "Pokud jste o obnovení hesla nežádali, tento e-mail prosím ignorujte.",
                "security_note": "Z bezpečnostních důvodů budou po obnovení hesla odhlášeny všechny vaše aktivní relace.",
                "trouble_text": "Máte problémy? Zkopírujte a vložte tento odkaz do prohlížeče:"
            }
        
        # Generate HTML email content
        html_content = self._generate_email_html(
            title=template_data["title"],
            content=f"""
                <h2 style="color: #333; margin-bottom: 20px;">{template_data["greeting"]}</h2>
                <p style="color: #666; margin-bottom: 30px;">{template_data["message"]}</p>
                
                <div style="text-align: center; margin: 40px 0;">
                    <a href="{reset_url}" 
                       style="background-color: #FF5722; color: white; padding: 15px 30px; 
                              text-decoration: none; border-radius: 5px; display: inline-block;
                              font-weight: bold; font-size: 16px;">
                        {template_data["button_text"]}
                    </a>
                </div>
                
                <div style="background-color: #FFF3E0; border: 1px solid #FFE0B2; 
                            border-radius: 5px; padding: 15px; margin: 30px 0;">
                    <p style="color: #E65100; font-size: 14px; margin: 0;">
                        <strong>⚠️ {template_data["expires_text"]}</strong>
                    </p>
                </div>
                
                <p style="color: #666; font-size: 14px; margin: 20px 0;">
                    {template_data["security_note"]}
                </p>
                
                <hr style="border: none; border-top: 1px solid #eee; margin: 40px 0;">
                
                <p style="color: #999; font-size: 12px; margin-bottom: 10px;">
                    {template_data["trouble_text"]}
                </p>
                <p style="color: #999; font-size: 12px; word-break: break-all;">
                    {reset_url}
                </p>
                
                <hr style="border: none; border-top: 1px solid #eee; margin: 40px 0;">
                
                <p style="color: #999; font-size: 12px; text-align: center;">
                    {template_data["footer"]}
                </p>
            """
        )
        
        # Mock email sending - log to console
        logger.info(
            f"📧 MOCK EMAIL SENT\n"
            f"To: {to_email}\n"
            f"Subject: {subject}\n"
            f"Reset URL: {reset_url}\n"
            f"Language: {language}\n"
            f"HTML Preview: [HTML email with password reset button and security warning]"
        )
        
        # In production, this would use an actual email service
        # The HTML content would be sent as the email body
        
        # Simulate async operation
        await asyncio.sleep(0.1)
        
        return True
    
    async def send_login_alert_email(
        self,
        to_email: str,
        ip_address: str,
        user_agent: str,
        timestamp: datetime,
        language: str = "cs"
    ) -> bool:
        """
        Send security alert for new login.
        
        Args:
            to_email: Recipient email address
            ip_address: IP address of login attempt
            user_agent: User agent string
            timestamp: Login timestamp
            language: User's preferred language (cs/en)
            
        Returns:
            True if email was sent successfully
        """
        # Choose language-specific content
        if language == "en":
            subject = "New login to your Jídelníček 2.0 account"
            template_data = {
                "title": "Security Alert",
                "greeting": "New Login Detected",
                "message": f"A new login to your account was detected from:",
                "details": {
                    "IP Address": ip_address,
                    "Device": self._parse_user_agent(user_agent),
                    "Time": timestamp.strftime("%Y-%m-%d %H:%M:%S UTC")
                },
                "footer": "If this wasn't you, please change your password immediately."
            }
        else:  # Czech (default)
            subject = "Nové přihlášení k vašemu účtu Jídelníček 2.0"
            template_data = {
                "title": "Bezpečnostní upozornění",
                "greeting": "Zjištěno nové přihlášení",
                "message": f"Bylo zjištěno nové přihlášení k vašemu účtu z:",
                "details": {
                    "IP adresa": ip_address,
                    "Zařízení": self._parse_user_agent(user_agent),
                    "Čas": timestamp.strftime("%d.%m.%Y %H:%M:%S UTC")
                },
                "footer": "Pokud jste to nebyli vy, okamžitě změňte své heslo."
            }
        
        # Mock email sending - log to console
        logger.info(
            f"📧 MOCK EMAIL SENT\n"
            f"To: {to_email}\n"
            f"Subject: {subject}\n"
            f"Language: {language}\n"
            f"Template Data: {template_data}"
        )
        
        # Simulate async operation
        await asyncio.sleep(0.1)
        
        return True
    
    async def send_account_locked_email(
        self,
        to_email: str,
        locked_until: datetime,
        failed_attempts: int,
        language: str = "cs"
    ) -> bool:
        """
        Send notification about account lockout.
        
        Args:
            to_email: Recipient email address
            locked_until: When the account will be unlocked
            failed_attempts: Number of failed login attempts
            language: User's preferred language (cs/en)
            
        Returns:
            True if email was sent successfully
        """
        # Choose language-specific content
        if language == "en":
            subject = "Your Jídelníček 2.0 account has been locked"
            template_data = {
                "title": "Account Locked",
                "greeting": "Security Notice",
                "message": f"Your account has been temporarily locked after {failed_attempts} failed login attempts.",
                "unlock_time": f"Your account will be unlocked at: {locked_until.strftime('%Y-%m-%d %H:%M:%S UTC')}",
                "footer": "If you're having trouble accessing your account, please reset your password."
            }
        else:  # Czech (default)
            subject = "Váš účet Jídelníček 2.0 byl uzamčen"
            template_data = {
                "title": "Účet uzamčen",
                "greeting": "Bezpečnostní oznámení",
                "message": f"Váš účet byl dočasně uzamčen po {failed_attempts} neúspěšných pokusech o přihlášení.",
                "unlock_time": f"Váš účet bude odemčen v: {locked_until.strftime('%d.%m.%Y %H:%M:%S UTC')}",
                "footer": "Pokud máte problémy s přístupem k účtu, obnovte prosím své heslo."
            }
        
        # Mock email sending - log to console
        logger.info(
            f"📧 MOCK EMAIL SENT\n"
            f"To: {to_email}\n"
            f"Subject: {subject}\n"
            f"Language: {language}\n"
            f"Template Data: {template_data}"
        )
        
        # Simulate async operation
        await asyncio.sleep(0.1)
        
        return True
    
    def _parse_user_agent(self, user_agent: str) -> str:
        """
        Parse user agent string to human-readable device info.
        
        Args:
            user_agent: Raw user agent string
            
        Returns:
            Simplified device description
        """
        # Simple parsing - in production, use a proper user agent parser
        if "Windows" in user_agent:
            device = "Windows PC"
        elif "Mac" in user_agent:
            device = "Mac"
        elif "iPhone" in user_agent:
            device = "iPhone"
        elif "Android" in user_agent:
            device = "Android device"
        elif "Linux" in user_agent:
            device = "Linux PC"
        else:
            device = "Unknown device"
        
        # Add browser info
        if "Chrome" in user_agent:
            device += " (Chrome)"
        elif "Firefox" in user_agent:
            device += " (Firefox)"
        elif "Safari" in user_agent and "Chrome" not in user_agent:
            device += " (Safari)"
        elif "Edge" in user_agent:
            device += " (Edge)"
        
        return device
    
    async def send_email_changed_notification(
        self,
        old_email: str,
        new_email: str,
        language: str = "cs"
    ) -> bool:
        """
        Send notification about email address change.
        
        Args:
            old_email: Previous email address
            new_email: New email address
            language: User's preferred language (cs/en)
            
        Returns:
            True if emails were sent successfully
        """
        # Send to old email
        if language == "en":
            subject = "Your Jídelníček 2.0 email has been changed"
            message = f"Your email address has been changed to: {new_email}"
        else:
            subject = "Váš e-mail Jídelníček 2.0 byl změněn"
            message = f"Vaše e-mailová adresa byla změněna na: {new_email}"
        
        logger.info(
            f"📧 MOCK EMAIL SENT\n"
            f"To: {old_email}\n"
            f"Subject: {subject}\n"
            f"Message: {message}"
        )
        
        # Send verification to new email
        # This would typically trigger a new verification process
        
        await asyncio.sleep(0.1)
        return True
    
    async def send_password_reset_confirmation_email(
        self,
        to_email: str,
        language: str = "cs"
    ) -> bool:
        """
        Send password reset confirmation email.
        
        Args:
            to_email: Recipient email address
            language: User's preferred language (cs/en)
            
        Returns:
            True if email was sent successfully
        """
        # Choose language-specific content
        if language == "en":
            subject = "Your Jídelníček 2.0 password has been reset"
            template_data = {
                "title": "Password Reset Successful",
                "greeting": "Password Successfully Reset",
                "message": "Your password has been successfully reset. You can now log in with your new password.",
                "security_notice": "For security reasons, all your previous sessions have been logged out. Please log in again on your devices.",
                "warning": "If you did not reset your password, please contact support immediately and change your password.",
                "button_text": "Go to Login",
                "support_text": "Need help? Contact our support team."
            }
        else:  # Czech (default)
            subject = "Vaše heslo Jídelníček 2.0 bylo obnoveno"
            template_data = {
                "title": "Obnovení hesla dokončeno",
                "greeting": "Heslo bylo úspěšně obnoveno",
                "message": "Vaše heslo bylo úspěšně obnoveno. Nyní se můžete přihlásit s novým heslem.",
                "security_notice": "Z bezpečnostních důvodů byly všechny vaše předchozí relace odhlášeny. Přihlaste se prosím znovu na svých zařízeních.",
                "warning": "Pokud jste heslo neobnovovali vy, okamžitě kontaktujte podporu a změňte své heslo.",
                "button_text": "Přejít na přihlášení",
                "support_text": "Potřebujete pomoc? Kontaktujte náš tým podpory."
            }
        
        login_url = f"{self.base_url}/login"
        
        # Generate HTML email content
        html_content = self._generate_email_html(
            title=template_data["title"],
            content=f"""
                <h2 style="color: #333; margin-bottom: 20px;">{template_data["greeting"]}</h2>
                <p style="color: #666; margin-bottom: 30px;">{template_data["message"]}</p>
                
                <div style="background-color: #E3F2FD; border: 1px solid #BBDEFB; 
                            border-radius: 5px; padding: 15px; margin: 30px 0;">
                    <p style="color: #1565C0; font-size: 14px; margin: 0;">
                        <strong>🔒 {template_data["security_notice"]}</strong>
                    </p>
                </div>
                
                <div style="text-align: center; margin: 40px 0;">
                    <a href="{login_url}" 
                       style="background-color: #4CAF50; color: white; padding: 15px 30px; 
                              text-decoration: none; border-radius: 5px; display: inline-block;
                              font-weight: bold; font-size: 16px;">
                        {template_data["button_text"]}
                    </a>
                </div>
                
                <div style="background-color: #FFEBEE; border: 1px solid #FFCDD2; 
                            border-radius: 5px; padding: 15px; margin: 30px 0;">
                    <p style="color: #C62828; font-size: 14px; margin: 0;">
                        <strong>⚠️ {template_data["warning"]}</strong>
                    </p>
                </div>
                
                <hr style="border: none; border-top: 1px solid #eee; margin: 40px 0;">
                
                <p style="color: #666; font-size: 14px; text-align: center;">
                    {template_data["support_text"]}
                </p>
            """
        )
        
        # Mock email sending - log to console
        logger.info(
            f"📧 MOCK EMAIL SENT\n"
            f"To: {to_email}\n"
            f"Subject: {subject}\n"
            f"Language: {language}\n"
            f"HTML Preview: [HTML email confirming password reset with security warnings]"
        )
        
        # Simulate async operation
        await asyncio.sleep(0.1)
        
        return True