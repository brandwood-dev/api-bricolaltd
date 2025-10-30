import { Injectable, Logger } from '@nestjs/common';
import { SendGridService } from '../../emails/sendgrid.service';
import { Booking } from '../entities/booking.entity';
import { User } from '../../users/entities/user.entity';

export interface DepositNotificationData {
  booking: Booking;
  user: User;
  toolName: string;
  rentalStartDate: Date;
  rentalEndDate: Date;
  depositAmount: number;
  hoursUntilCapture: number;
}

@Injectable()
export class DepositNotificationService {
  private readonly logger = new Logger(DepositNotificationService.name);

  constructor(private readonly sendGridService: SendGridService) {}

  async sendDepositReminderEmail(data: DepositNotificationData): Promise<boolean> {
    try {
      const { booking, user, toolName, rentalStartDate, rentalEndDate, depositAmount, hoursUntilCapture } = data;
      
      const html = this.generateDepositReminderHtml(data);
      const text = this.generateDepositReminderText(data);

      const success = await this.sendGridService.sendEmail({
        to: user.email,
        subject: `Rappel : Caution de ${depositAmount}€ pour votre location - ${toolName}`,
        html,
        text
      });

      if (success) {
        this.logger.log(`Deposit reminder email sent successfully to ${user.email} for booking ${booking.id}`);
      } else {
        this.logger.error(`Failed to send deposit reminder email to ${user.email} for booking ${booking.id}`);
      }

      return success;
    } catch (error) {
      this.logger.error(`Error sending deposit reminder email for booking ${data.booking.id}:`, error);
      return false;
    }
  }

  async sendDepositCapturedEmail(data: DepositNotificationData & { capturedAmount: number }): Promise<boolean> {
    try {
      const { booking, user, toolName, capturedAmount } = data;
      
      const html = this.generateDepositCapturedHtml(data);
      const text = this.generateDepositCapturedText(data);

      const success = await this.sendGridService.sendEmail({
        to: user.email,
        subject: `Caution prélevée : ${capturedAmount}€ pour votre location - ${toolName}`,
        html,
        text
      });

      if (success) {
        this.logger.log(`Deposit captured email sent successfully to ${user.email} for booking ${booking.id}`);
      } else {
        this.logger.error(`Failed to send deposit captured email to ${user.email} for booking ${booking.id}`);
      }

      return success;
    } catch (error) {
      this.logger.error(`Error sending deposit captured email for booking ${data.booking.id}:`, error);
      return false;
    }
  }

  async sendDepositFailedEmail(data: DepositNotificationData & { failureReason: string }): Promise<boolean> {
    try {
      const { booking, user, toolName, failureReason } = data;
      
      const html = this.generateDepositFailedHtml(data);
      const text = this.generateDepositFailedText(data);

      const success = await this.sendGridService.sendEmail({
        to: user.email,
        subject: `Échec du prélèvement de caution pour votre location - ${toolName}`,
        html,
        text
      });

      if (success) {
        this.logger.log(`Deposit failed email sent successfully to ${user.email} for booking ${booking.id}`);
      } else {
        this.logger.error(`Failed to send deposit failed email to ${user.email} for booking ${booking.id}`);
      }

      return success;
    } catch (error) {
      this.logger.error(`Error sending deposit failed email for booking ${data.booking.id}:`, error);
      return false;
    }
  }

  async sendDepositRefundedEmail(data: DepositNotificationData & { refundedAmount: number; refundReason?: string }): Promise<boolean> {
    try {
      const { booking, user, toolName, refundedAmount, refundReason } = data;
      
      const html = this.generateDepositRefundedHtml(data);
      const text = this.generateDepositRefundedText(data);

      const success = await this.sendGridService.sendEmail({
        to: user.email,
        subject: `Remboursement de caution : ${refundedAmount}€ pour votre location - ${toolName}`,
        html,
        text
      });

      if (success) {
        this.logger.log(`Deposit refunded email sent successfully to ${user.email} for booking ${booking.id}`);
      } else {
        this.logger.error(`Failed to send deposit refunded email to ${user.email} for booking ${booking.id}`);
      }

      return success;
    } catch (error) {
      this.logger.error(`Error sending deposit refunded email for booking ${data.booking.id}:`, error);
      return false;
    }
  }

  private generateDepositReminderHtml(data: DepositNotificationData): string {
    const { user, toolName, rentalStartDate, rentalEndDate, depositAmount, hoursUntilCapture } = data;
    
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Rappel de caution - Bricola</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #ff6b35, #f7931e); color: white; padding: 30px 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { padding: 30px 20px; background: #ffffff; border: 1px solid #e9ecef; }
          .info-box { margin: 20px 0; padding: 20px; background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 8px; }
          .warning-box { margin: 20px 0; padding: 20px; background: #f8d7da; border: 1px solid #f5c6cb; border-radius: 8px; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; background: #f8f9fa; border-radius: 0 0 8px 8px; }
          .highlight { color: #ff6b35; font-weight: bold; }
          .amount { font-size: 24px; font-weight: bold; color: #ff6b35; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0; font-size: 28px;">🔧 Bricola</h1>
            <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">Rappel de caution</p>
          </div>
          <div class="content">
            <h2 style="color: #ff6b35; margin-top: 0;">Bonjour ${user.firstName || user.email} !</h2>
            
            <p>Votre location approche et nous souhaitons vous rappeler les détails de votre caution.</p>
            
            <div class="info-box">
              <h3 style="margin-top: 0; color: #856404;">📋 Détails de votre location</h3>
              <p><strong>Outil :</strong> ${toolName}</p>
              <p><strong>Période :</strong> Du ${rentalStartDate.toLocaleDateString('fr-FR')} au ${rentalEndDate.toLocaleDateString('fr-FR')}</p>
              <p><strong>Montant de la caution :</strong> <span class="amount">${depositAmount}€</span></p>
            </div>
            
            <div class="warning-box">
              <h3 style="margin-top: 0; color: #721c24;">⏰ Prélèvement automatique</h3>
              <p>La caution sera <strong>automatiquement prélevée dans ${hoursUntilCapture} heures</strong> (24h avant le début de votre location).</p>
              <p>Assurez-vous que votre méthode de paiement est valide et dispose de fonds suffisants.</p>
            </div>
            
            <h3>💡 Informations importantes :</h3>
            <ul>
              <li>La caution sera remboursée automatiquement après la restitution de l'outil en bon état</li>
              <li>En cas de dommages, seul le montant des réparations sera déduit</li>
              <li>Le remboursement s'effectue sous 3-5 jours ouvrés</li>
            </ul>
            
            <p style="margin-top: 30px;">Si vous avez des questions, n'hésitez pas à nous contacter.</p>
            <p>Merci de votre confiance !</p>
            <p><strong>L'équipe Bricola</strong></p>
          </div>
          <div class="footer">
            <p>© 2024 Bricola. Tous droits réservés.</p>
            <p>Email automatique - Ne pas répondre</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private generateDepositReminderText(data: DepositNotificationData): string {
    const { user, toolName, rentalStartDate, rentalEndDate, depositAmount, hoursUntilCapture } = data;
    
    return `
Rappel de caution - Bricola

Bonjour ${user.firstName || user.email} !

Votre location approche et nous souhaitons vous rappeler les détails de votre caution.

DÉTAILS DE VOTRE LOCATION :
- Outil : ${toolName}
- Période : Du ${rentalStartDate.toLocaleDateString('fr-FR')} au ${rentalEndDate.toLocaleDateString('fr-FR')}
- Montant de la caution : ${depositAmount}€

⏰ PRÉLÈVEMENT AUTOMATIQUE :
La caution sera automatiquement prélevée dans ${hoursUntilCapture} heures (24h avant le début de votre location).
Assurez-vous que votre méthode de paiement est valide et dispose de fonds suffisants.

INFORMATIONS IMPORTANTES :
- La caution sera remboursée automatiquement après la restitution de l'outil en bon état
- En cas de dommages, seul le montant des réparations sera déduit
- Le remboursement s'effectue sous 3-5 jours ouvrés

Si vous avez des questions, n'hésitez pas à nous contacter.
Merci de votre confiance !

L'équipe Bricola

© 2024 Bricola. Tous droits réservés.
Email automatique - Ne pas répondre
    `;
  }

  private generateDepositCapturedHtml(data: DepositNotificationData & { capturedAmount: number }): string {
    const { user, toolName, rentalStartDate, capturedAmount } = data;
    
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Caution prélevée - Bricola</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #28a745, #20c997); color: white; padding: 30px 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { padding: 30px 20px; background: #ffffff; border: 1px solid #e9ecef; }
          .success-box { margin: 20px 0; padding: 20px; background: #d4edda; border: 1px solid #c3e6cb; border-radius: 8px; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; background: #f8f9fa; border-radius: 0 0 8px 8px; }
          .amount { font-size: 24px; font-weight: bold; color: #28a745; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0; font-size: 28px;">🔧 Bricola</h1>
            <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">Caution prélevée</p>
          </div>
          <div class="content">
            <h2 style="color: #28a745; margin-top: 0;">Bonjour ${user.firstName || user.email} !</h2>
            
            <div class="success-box">
              <h3 style="margin-top: 0; color: #155724;">✅ Caution prélevée avec succès</h3>
              <p>Nous avons prélevé la caution de <span class="amount">${capturedAmount}€</span> pour votre location de <strong>${toolName}</strong>.</p>
              <p><strong>Date de début :</strong> ${rentalStartDate.toLocaleDateString('fr-FR')}</p>
            </div>
            
            <h3>💡 Que se passe-t-il maintenant ?</h3>
            <ul>
              <li>Votre location commence aujourd'hui - profitez bien de votre outil !</li>
              <li>La caution sera automatiquement remboursée après la restitution en bon état</li>
              <li>Le remboursement s'effectue sous 3-5 jours ouvrés après la fin de location</li>
              <li>En cas de dommages, seuls les frais de réparation seront déduits</li>
            </ul>
            
            <p style="margin-top: 30px;">Bonne location et merci de votre confiance !</p>
            <p><strong>L'équipe Bricola</strong></p>
          </div>
          <div class="footer">
            <p>© 2024 Bricola. Tous droits réservés.</p>
            <p>Email automatique - Ne pas répondre</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private generateDepositCapturedText(data: DepositNotificationData & { capturedAmount: number }): string {
    const { user, toolName, rentalStartDate, capturedAmount } = data;
    
    return `
Caution prélevée - Bricola

Bonjour ${user.firstName || user.email} !

✅ CAUTION PRÉLEVÉE AVEC SUCCÈS
Nous avons prélevé la caution de ${capturedAmount}€ pour votre location de ${toolName}.
Date de début : ${rentalStartDate.toLocaleDateString('fr-FR')}

QUE SE PASSE-T-IL MAINTENANT ?
- Votre location commence aujourd'hui - profitez bien de votre outil !
- La caution sera automatiquement remboursée après la restitution en bon état
- Le remboursement s'effectue sous 3-5 jours ouvrés après la fin de location
- En cas de dommages, seuls les frais de réparation seront déduits

Bonne location et merci de votre confiance !

L'équipe Bricola

© 2024 Bricola. Tous droits réservés.
Email automatique - Ne pas répondre
    `;
  }

  private generateDepositFailedHtml(data: DepositNotificationData & { failureReason: string }): string {
    const { user, toolName, rentalStartDate, failureReason } = data;
    
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Échec du prélèvement de caution - Bricola</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #dc3545, #c82333); color: white; padding: 30px 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { padding: 30px 20px; background: #ffffff; border: 1px solid #e9ecef; }
          .error-box { margin: 20px 0; padding: 20px; background: #f8d7da; border: 1px solid #f5c6cb; border-radius: 8px; }
          .action-box { margin: 20px 0; padding: 20px; background: #d1ecf1; border: 1px solid #bee5eb; border-radius: 8px; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; background: #f8f9fa; border-radius: 0 0 8px 8px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0; font-size: 28px;">🔧 Bricola</h1>
            <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">Problème de caution</p>
          </div>
          <div class="content">
            <h2 style="color: #dc3545; margin-top: 0;">Bonjour ${user.firstName || user.email} !</h2>
            
            <div class="error-box">
              <h3 style="margin-top: 0; color: #721c24;">❌ Échec du prélèvement de caution</h3>
              <p>Nous n'avons pas pu prélever la caution pour votre location de <strong>${toolName}</strong> prévue le ${rentalStartDate.toLocaleDateString('fr-FR')}.</p>
              <p><strong>Raison :</strong> ${failureReason}</p>
            </div>
            
            <div class="action-box">
              <h3 style="margin-top: 0; color: #0c5460;">🔧 Action requise</h3>
              <p><strong>Votre réservation risque d'être annulée.</strong></p>
              <p>Pour éviter l'annulation, veuillez :</p>
              <ol>
                <li>Vérifier que votre carte bancaire est valide et non expirée</li>
                <li>Vous assurer que vous disposez de fonds suffisants</li>
                <li>Contacter votre banque si nécessaire</li>
                <li>Nous contacter si le problème persiste</li>
              </ol>
            </div>
            
            <p style="margin-top: 30px;">Nous tenterons un nouveau prélèvement dans quelques heures. Si le problème persiste, votre réservation sera automatiquement annulée.</p>
            <p>Pour toute question, contactez-nous rapidement.</p>
            <p><strong>L'équipe Bricola</strong></p>
          </div>
          <div class="footer">
            <p>© 2024 Bricola. Tous droits réservés.</p>
            <p>Email automatique - Ne pas répondre</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private generateDepositFailedText(data: DepositNotificationData & { failureReason: string }): string {
    const { user, toolName, rentalStartDate, failureReason } = data;
    
    return `
Échec du prélèvement de caution - Bricola

Bonjour ${user.firstName || user.email} !

❌ ÉCHEC DU PRÉLÈVEMENT DE CAUTION
Nous n'avons pas pu prélever la caution pour votre location de ${toolName} prévue le ${rentalStartDate.toLocaleDateString('fr-FR')}.
Raison : ${failureReason}

🔧 ACTION REQUISE
Votre réservation risque d'être annulée.

Pour éviter l'annulation, veuillez :
1. Vérifier que votre carte bancaire est valide et non expirée
2. Vous assurer que vous disposez de fonds suffisants
3. Contacter votre banque si nécessaire
4. Nous contacter si le problème persiste

Nous tenterons un nouveau prélèvement dans quelques heures. Si le problème persiste, votre réservation sera automatiquement annulée.

Pour toute question, contactez-nous rapidement.

L'équipe Bricola

© 2024 Bricola. Tous droits réservés.
Email automatique - Ne pas répondre
    `;
  }

  private generateDepositRefundedHtml(data: DepositNotificationData & { refundedAmount: number; refundReason?: string }): string {
    const { user, toolName, refundedAmount, refundReason } = data;
    
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Remboursement de caution - Bricola</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #17a2b8, #138496); color: white; padding: 30px 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { padding: 30px 20px; background: #ffffff; border: 1px solid #e9ecef; }
          .success-box { margin: 20px 0; padding: 20px; background: #d1ecf1; border: 1px solid #bee5eb; border-radius: 8px; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; background: #f8f9fa; border-radius: 0 0 8px 8px; }
          .amount { font-size: 24px; font-weight: bold; color: #17a2b8; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0; font-size: 28px;">🔧 Bricola</h1>
            <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">Remboursement de caution</p>
          </div>
          <div class="content">
            <h2 style="color: #17a2b8; margin-top: 0;">Bonjour ${user.firstName || user.email} !</h2>
            
            <div class="success-box">
              <h3 style="margin-top: 0; color: #0c5460;">💰 Remboursement effectué</h3>
              <p>Nous avons procédé au remboursement de <span class="amount">${refundedAmount}€</span> pour la caution de votre location de <strong>${toolName}</strong>.</p>
              ${refundReason ? `<p><strong>Motif :</strong> ${refundReason}</p>` : ''}
            </div>
            
            <h3>📋 Informations importantes :</h3>
            <ul>
              <li>Le remboursement apparaîtra sur votre compte sous 3-5 jours ouvrés</li>
              <li>Vous recevrez une notification de votre banque lors du crédit</li>
              <li>Le montant sera crédité sur la même carte utilisée pour la caution</li>
            </ul>
            
            <p style="margin-top: 30px;">Merci d'avoir utilisé Bricola ! Nous espérons vous revoir bientôt.</p>
            <p><strong>L'équipe Bricola</strong></p>
          </div>
          <div class="footer">
            <p>© 2024 Bricola. Tous droits réservés.</p>
            <p>Email automatique - Ne pas répondre</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private generateDepositRefundedText(data: DepositNotificationData & { refundedAmount: number; refundReason?: string }): string {
    const { user, toolName, refundedAmount, refundReason } = data;
    
    return `
Remboursement de caution - Bricola

Bonjour ${user.firstName || user.email} !

💰 REMBOURSEMENT EFFECTUÉ
Nous avons procédé au remboursement de ${refundedAmount}€ pour la caution de votre location de ${toolName}.
${refundReason ? `Motif : ${refundReason}` : ''}

INFORMATIONS IMPORTANTES :
- Le remboursement apparaîtra sur votre compte sous 3-5 jours ouvrés
- Vous recevrez une notification de votre banque lors du crédit
- Le montant sera crédité sur la même carte utilisée pour la caution

Merci d'avoir utilisé Bricola ! Nous espérons vous revoir bientôt.

L'équipe Bricola

© 2024 Bricola. Tous droits réservés.
Email automatique - Ne pas répondre
    `;
  }
}