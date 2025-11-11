import { Injectable, Logger } from '@nestjs/common';
const sgMail = require('@sendgrid/mail');
import { ConfigService } from '@nestjs/config';
import { EmailsService } from './emails.service';
import { EmailType } from './dto/create-email.dto';

export interface SendGridEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  userId?: string; // optional: persist email log for this user
}

@Injectable()
export class SendGridService {
  private readonly logger = new Logger(SendGridService.name);

  constructor(private configService: ConfigService, private emailsService: EmailsService) {
    const apiKey = this.configService.get('SENDGRID_API_KEY');
    if (apiKey) {
      sgMail.setApiKey(apiKey);
      this.logger.log('SendGrid service initialized successfully');
    } else {
      this.logger.error('SENDGRID_API_KEY not found in environment variables');
    }
  }

  async sendEmail(options: SendGridEmailOptions): Promise<boolean> {
    try {
      const fromEmail = this.configService.get('SENDGRID_FROM_EMAIL', 'noreply@bricolaltd.com');
      const fromName = this.configService.get('SENDGRID_FROM_NAME', 'Bricola LTD');

      const msg = {
        to: options.to,
        from: {
          email: fromEmail,
          name: fromName
        },
        subject: options.subject,
        text: options.text || options.html.replace(/<[^>]*>/g, ''), // Strip HTML for text version
        html: options.html,
      };

      const response = await sgMail.send(msg);
      this.logger.log(`Email sent successfully to ${options.to}`);
      this.logger.log(`SendGrid response status: ${response[0].statusCode}`);
      // Persist a lightweight email log for validation in tests if userId provided
      if (options.userId) {
        try {
          await this.emailsService.create({
            userId: options.userId,
            subject: options.subject,
            content: options.html,
            type: EmailType.GENERAL,
            isRead: false,
          });
        } catch (persistErr) {
          this.logger.warn(`Failed to persist email log for user ${options.userId}: ${persistErr?.message || persistErr}`);
        }
      }
      
      return true;
    } catch (error) {
      this.logger.error(`Failed to send email to ${options.to}`, error);
      if (error.response) {
        this.logger.error('SendGrid error response:', error.response.body);
      }
      return false;
    }
  }

  async sendTestEmail(to: string): Promise<boolean> {
    const testEmailOptions: SendGridEmailOptions = {
      to,
      subject: 'Test Email from Bricola - SendGrid Integration',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Test Email</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #007bff; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { padding: 20px; background: #f9f9f9; border-radius: 0 0 8px 8px; }
            .success { background: #d4edda; border: 1px solid #c3e6cb; color: #155724; padding: 15px; border-radius: 5px; margin: 20px 0; }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🎉 Bricola LTD</h1>
            </div>
            <div class="content">
              <h2>Test Email - SendGrid Integration</h2>
              <div class="success">
                <strong>✅ Success!</strong> SendGrid is working correctly!
              </div>
              <p>Bonjour,</p>
              <p>Ceci est un email de test pour vérifier l'intégration SendGrid avec l'API Bricola.</p>
              <p><strong>Détails du test :</strong></p>
              <ul>
                <li>Service : SendGrid</li>
                <li>Date : ${new Date().toLocaleString('fr-FR')}</li>
                <li>Destinataire : ${to}</li>
                <li>Status : Email envoyé avec succès</li>
              </ul>
              <p>Si vous recevez cet email, cela signifie que l'intégration SendGrid fonctionne parfaitement !</p>
            </div>
            <div class="footer">
              <p>© 2024 Bricola LTD. Tous droits réservés.</p>
              <p>Email de test - Ne pas répondre</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
Test Email - SendGrid Integration

Bonjour,

Ceci est un email de test pour vérifier l'intégration SendGrid avec l'API Bricola.

Détails du test :
- Service : SendGrid
- Date : ${new Date().toLocaleString('fr-FR')}
- Destinataire : ${to}
- Status : Email envoyé avec succès

Si vous recevez cet email, cela signifie que l'intégration SendGrid fonctionne parfaitement !

© 2024 Bricola LTD. Tous droits réservés.
Email de test - Ne pas répondre
      `
    };

    return this.sendEmail(testEmailOptions);
  }

  async sendVerificationEmail(email: string, verificationCode: string): Promise<boolean> {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Vérification de votre email</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #007bff, #0056b3); color: white; padding: 30px 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { padding: 30px 20px; background: #ffffff; border: 1px solid #e9ecef; }
          .code-box { margin: 30px 0; padding: 25px; background: #f8f9fa; border: 2px solid #007bff; border-radius: 12px; text-align: center; }
          .code { display: inline-block; padding: 20px 30px; background: #ffffff; border: 2px dashed #007bff; border-radius: 8px; font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #007bff; font-family: 'Courier New', monospace; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; background: #f8f9fa; border-radius: 0 0 8px 8px; }
          .warning { background: #fff3cd; border: 1px solid #ffeaa7; color: #856404; padding: 15px; border-radius: 5px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0; font-size: 28px;">🔐 Bricola</h1>
            <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">Vérification de votre compte</p>
          </div>
          <div class="content">
            <h2 style="color: #007bff; margin-top: 0;">Bienvenue sur Bricola !</h2>
            <p>Bonjour,</p>
            <p>Merci de vous être inscrit sur Bricola ! Pour finaliser votre inscription et sécuriser votre compte, veuillez utiliser le code de vérification ci-dessous :</p>
            
            <div class="code-box">
              <h3 style="margin-top: 0; color: #007bff; font-size: 18px;">Votre code de vérification</h3>
              <div class="code">${verificationCode}</div>
              <p style="margin-bottom: 0; font-size: 14px; color: #666; margin-top: 15px;">Entrez ce code sur la page de vérification</p>
            </div>
            
            <div class="warning">
              <strong>⏰ Important :</strong> Ce code expire dans <strong>15 minutes</strong> pour votre sécurité.
            </div>
            
            <p><strong>Instructions :</strong></p>
            <ol>
              <li>Retournez sur la page de vérification de Bricola</li>
              <li>Saisissez le code de vérification ci-dessus</li>
              <li>Cliquez sur "Vérifier" pour activer votre compte</li>
            </ol>
            
            <p style="margin-top: 30px; font-size: 14px; color: #666;">Si vous n'avez pas créé de compte sur Bricola, vous pouvez ignorer cet email en toute sécurité.</p>
          </div>
          <div class="footer">
            <p>© 2024 Bricola. Tous droits réservés.</p>
            <p>Email automatique - Ne pas répondre</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
      Vérification de votre email - Bricola
      
      Bonjour,
      
      Merci de vous être inscrit sur Bricola ! Pour finaliser votre inscription, utilisez le code de vérification suivant :
      
      CODE DE VÉRIFICATION : ${verificationCode}
      
      Instructions :
      1. Retournez sur la page de vérification de Bricola
      2. Saisissez le code de vérification ci-dessus
      3. Cliquez sur "Vérifier" pour activer votre compte
      
      ⏰ IMPORTANT : Ce code expire dans 15 minutes pour votre sécurité.
      
      Si vous n'avez pas créé de compte sur Bricola, vous pouvez ignorer cet email.
      
      © 2024 Bricola. Tous droits réservés.
    `;

    return this.sendEmail({
      to: email,
      subject: '🔐 Code de vérification - Bricola',
      html,
      text,
    });
  }

  async sendPasswordResetEmail(email: string, resetCode: string): Promise<boolean> {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Réinitialisation de votre mot de passe</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #dc3545, #c82333); color: white; padding: 30px 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { padding: 30px 20px; background: #ffffff; border: 1px solid #e9ecef; }
          .code-box { margin: 30px 0; padding: 25px; background: #f8f9fa; border: 2px solid #dc3545; border-radius: 12px; text-align: center; }
          .code { display: inline-block; padding: 20px 30px; background: #ffffff; border: 2px dashed #dc3545; border-radius: 8px; font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #dc3545; font-family: 'Courier New', monospace; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; background: #f8f9fa; border-radius: 0 0 8px 8px; }
          .warning { background: #fff3cd; border: 1px solid #ffeaa7; color: #856404; padding: 15px; border-radius: 5px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0; font-size: 28px;">🔑 Bricola</h1>
            <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">Réinitialisation de mot de passe</p>
          </div>
          <div class="content">
            <h2 style="color: #dc3545; margin-top: 0;">Réinitialisation de votre mot de passe</h2>
            <p>Bonjour,</p>
            <p>Vous avez demandé la réinitialisation de votre mot de passe sur Bricola. Utilisez le code ci-dessous pour procéder à la réinitialisation :</p>
            
            <div class="code-box">
              <h3 style="margin-top: 0; color: #dc3545; font-size: 18px;">Code de réinitialisation</h3>
              <div class="code">${resetCode}</div>
              <p style="margin-bottom: 0; font-size: 14px; color: #666; margin-top: 15px;">Entrez ce code sur la page de réinitialisation</p>
            </div>
            
            <div class="warning">
              <strong>⏰ Important :</strong> Ce code expire dans <strong>15 minutes</strong> pour votre sécurité.
            </div>
            
            <p><strong>Instructions :</strong></p>
            <ol>
              <li>Retournez sur la page de réinitialisation de Bricola</li>
              <li>Saisissez le code de réinitialisation ci-dessus</li>
              <li>Créez votre nouveau mot de passe</li>
            </ol>
            
            <p style="margin-top: 30px; font-size: 14px; color: #666;">Si vous n'avez pas demandé cette réinitialisation, vous pouvez ignorer cet email en toute sécurité.</p>
          </div>
          <div class="footer">
            <p>© 2024 Bricola. Tous droits réservés.</p>
            <p>Email automatique - Ne pas répondre</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
      Réinitialisation de votre mot de passe - Bricola
      
      Bonjour,
      
      Vous avez demandé la réinitialisation de votre mot de passe sur Bricola.
      
      Voici votre code de réinitialisation :
      ${resetCode}
      
      Instructions :
      1. Retournez sur la page de réinitialisation de Bricola
      2. Saisissez le code de réinitialisation ci-dessus
      3. Créez votre nouveau mot de passe
      
      ⏰ IMPORTANT : Ce code expire dans 15 minutes pour votre sécurité.
      
      Si vous n'avez pas demandé cette réinitialisation, vous pouvez ignorer cet email.
      
      © 2024 Bricola. Tous droits réservés.
    `;

    return this.sendEmail({
      to: email,
      subject: '🔑 Réinitialisation de mot de passe - Bricola',
      html,
      text,
    });
  }

  async sendAccountDeletionEmail(
    email: string,
    language: 'fr' | 'en' | 'ar' = 'fr',
    userId?: string,
  ): Promise<boolean> {
    // Multilingual subjects
    const subjects = {
      fr: '✅ Confirmation de suppression de compte - Bricola',
      en: '✅ Account Deletion Confirmation - Bricola',
      ar: '✅ تأكيد حذف الحساب - Bricola',
    } as const;

    // HTML templates per language
    const htmlTemplates = {
      fr: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Confirmation de suppression</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #16a34a, #15803d); color: white; padding: 30px 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { padding: 30px 20px; background: #ffffff; border: 1px solid #e9ecef; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; background: #f8f9fa; border-radius: 0 0 8px 8px; }
          .notice { background: #fff3cd; border: 1px solid #ffeaa7; color: #856404; padding: 15px; border-radius: 5px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0; font-size: 28px;">Bricola</h1>
            <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">Confirmation de suppression de compte</p>
          </div>
          <div class="content">
            <h2 style="color: #16a34a; margin-top: 0;">Votre compte a été supprimé</h2>
            <p>Bonjour,</p>
            <p>Nous confirmons la suppression de votre compte Bricola. Nous sommes désolés de vous voir partir.</p>
            <div class="notice">
              <strong>🗓 Suppression des données :</strong> Vos données personnelles seront définitivement supprimées de nos systèmes sous <strong>90 jours</strong>, conformément à notre politique de confidentialité et aux exigences légales.
            </div>
            <p>Si vous avez effectué des transactions ou des réservations, certaines données minimales peuvent être conservées temporairement afin de respecter nos obligations légales et comptables.</p>
            <p>Pour toute question, vous pouvez nous contacter à l'adresse suivante : support@bricolaltd.com</p>
          </div>
          <div class="footer">
            <p>© 2024 Bricola. Tous droits réservés.</p>
            <p>Email automatique - Ne pas répondre</p>
          </div>
        </div>
      </body>
      </html>
      `,
      en: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Account Deletion Confirmation</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #16a34a, #15803d); color: white; padding: 30px 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { padding: 30px 20px; background: #ffffff; border: 1px solid #e9ecef; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; background: #f8f9fa; border-radius: 0 0 8px 8px; }
          .notice { background: #fff3cd; border: 1px solid #ffeaa7; color: #856404; padding: 15px; border-radius: 5px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0; font-size: 28px;">Bricola</h1>
            <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">Account Deletion Confirmation</p>
          </div>
          <div class="content">
            <h2 style="color: #16a34a; margin-top: 0;">Your account has been deleted</h2>
            <p>Hello,</p>
            <p>We confirm the deletion of your Bricola account. We're sorry to see you go.</p>
            <div class="notice">
              <strong>🗓 Data removal:</strong> Your personal data will be permanently removed from our systems within <strong>90 days</strong>, in accordance with our privacy policy and legal requirements.
            </div>
            <p>If you had transactions or bookings, some minimal data may be retained temporarily to meet legal and accounting obligations.</p>
            <p>If you have questions, please contact us at: support@bricolaltd.com</p>
          </div>
          <div class="footer">
            <p>© 2024 Bricola. All rights reserved.</p>
            <p>Automated email - Do not reply</p>
          </div>
        </div>
      </body>
      </html>
      `,
      ar: `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="utf-8">
        <title>تأكيد حذف الحساب</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; direction: rtl; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #16a34a, #15803d); color: white; padding: 30px 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { padding: 30px 20px; background: #ffffff; border: 1px solid #e9ecef; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; background: #f8f9fa; border-radius: 0 0 8px 8px; }
          .notice { background: #fff3cd; border: 1px solid #ffeaa7; color: #856404; padding: 15px; border-radius: 5px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0; font-size: 28px;">Bricola</h1>
            <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">تأكيد حذف الحساب</p>
          </div>
          <div class="content">
            <h2 style="color: #16a34a; margin-top: 0;">تم حذف حسابك</h2>
            <p>مرحباً،</p>
            <p>نؤكد حذف حسابك في Bricola. يؤسفنا رحيلك.</p>
            <div class="notice">
              <strong>🗓 حذف البيانات:</strong> سيتم حذف بياناتك الشخصية نهائياً من أنظمتنا خلال <strong>90 يوماً</strong> وفقاً لسياسة الخصوصية والمتطلبات القانونية.
            </div>
            <p>إذا كانت لديك معاملات أو حجوزات، فقد يتم الاحتفاظ ببعض البيانات الأساسية مؤقتاً للامتثال للالتزامات القانونية والمحاسبية.</p>
            <p>لأي استفسار، يرجى التواصل معنا عبر: support@bricolaltd.com</p>
          </div>
          <div class="footer">
            <p>© 2024 Bricola. جميع الحقوق محفوظة.</p>
            <p>بريد تلقائي - لا ترد</p>
          </div>
        </div>
      </body>
      </html>
      `,
    } as const;

    const textTemplates = {
      fr: `Votre compte a été supprimé. Vos données seront définitivement supprimées sous 90 jours.`,
      en: `Your account has been deleted. Your data will be permanently removed within 90 days.`,
      ar: `تم حذف حسابك. سيتم حذف بياناتك نهائياً خلال 90 يوماً.`,
    } as const;

    const subject = subjects[language] || subjects.fr;
    const html = htmlTemplates[language] || htmlTemplates.fr;
    const text = textTemplates[language] || textTemplates.fr;

    return this.sendEmail({
      to: email,
      subject,
      html,
      text,
      userId,
    });
  }
}