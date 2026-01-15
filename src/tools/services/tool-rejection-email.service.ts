import { Injectable } from '@nestjs/common';

export type ToolRejectionReasonKey =
  | 'incomplete_information'
  | 'non_compliant_price'
  | 'poor_quality_photos'
  | 'insufficient_description'
  | 'inappropriate_content'
  | 'false_or_misleading_information';

export interface ToolRejectionEmailTemplate {
  subject: string;
  html: string;
  text: string;
}

@Injectable()
export class ToolRejectionEmailService {
  getRejectionEmailTemplate(
    reason: string,
    firstName: string | undefined,
    toolName: string,
    frontendUrlEnv?: string,
  ): ToolRejectionEmailTemplate {
    const key = this.normalizeReason(reason);
    const frontendUrl =
      frontendUrlEnv || process.env.FRONTEND_URL || 'http://localhost:3000';
    const namePart = firstName ? ` ${firstName}` : '';
    const baseTextFooter = `\n\nWe remain available should you need any assistance.\nSincerely,\nThe BricolaLTD Team\n\n© ${new Date().getFullYear()} BricolaLTD. All rights reserved.`;

    switch (key) {
      case 'incomplete_information':
        return this.buildTemplate(
          'Incomplete Information',
          `Hello${namePart},\n\nYour rental listing could not be approved because it contains incomplete information.\nPlease check and complete all the required fields (title, description, location, price, photos, etc.) before submitting it again.${baseTextFooter}`,
          `Hello${namePart},\n\nYour rental listing could not be approved because it contains incomplete information.\nPlease check and complete all the required fields (title, description, location, price, photos, etc.) before submitting it again.${baseTextFooter}`,
          namePart,
          frontendUrl,
        );
      case 'non_compliant_price':
        return this.buildTemplate(
          'Non-Compliant Price',
          `Hello${namePart},\n\nYour rental listing has been rejected because the indicated price does not comply with our validation criteria.\nPlease adjust the proposed rate so that it complies with the platform’s rules and reflects the actual value of the tool.\nOnce corrected, you may resubmit your listing.${baseTextFooter}`,
          `Hello${namePart},\n\nYour rental listing has been rejected because the indicated price does not comply with our validation criteria.\nPlease adjust the proposed rate so that it complies with the platform’s rules and reflects the actual value of the tool.\nOnce corrected, you may resubmit your listing.${baseTextFooter}`,
          namePart,
          frontendUrl,
        );
      case 'poor_quality_photos':
        return this.buildTemplate(
          'Poor Quality Photos',
          `Hello${namePart},\n\nYour rental listing has been rejected because the provided photos are not clear or suitable enough.\nWe invite you to add sharp, recent, and representative images of the tool to ensure a better experience for renters.\nYou may then republish your listing once the photos have been updated.${baseTextFooter}`,
          `Hello${namePart},\n\nYour rental listing has been rejected because the provided photos are not clear or suitable enough.\nWe invite you to add sharp, recent, and representative images of the tool to ensure a better experience for renters.\nYou may then republish your listing once the photos have been updated.${baseTextFooter}`,
          namePart,
          frontendUrl,
        );
      case 'insufficient_description':
        return this.buildTemplate(
          'Insufficient Description',
          `Hello${namePart},\n\nYour rental listing has been rejected because the tool description is insufficient.\nWe recommend providing more details regarding the tool’s condition, features, and usage conditions in order to reassure future renters.\nOnce improved, you may resubmit your listing.${baseTextFooter}`,
          `Hello${namePart},\n\nYour rental listing has been rejected because the tool description is insufficient.\nWe recommend providing more details regarding the tool’s condition, features, and usage conditions in order to reassure future renters.\nOnce improved, you may resubmit your listing.${baseTextFooter}`,
          namePart,
          frontendUrl,
        );
      case 'inappropriate_content':
        return this.buildTemplate(
          'Inappropriate Content',
          `Hello${namePart},\n\nYour rental listing has been rejected due to the presence of inappropriate content.\nPlease correct or remove the non-compliant elements before attempting a new submission.\nWe thank you for your understanding and cooperation.${baseTextFooter}`,
          `Hello${namePart},\n\nYour rental listing has been rejected due to the presence of inappropriate content.\nPlease correct or remove the non-compliant elements before attempting a new submission.\nWe thank you for your understanding and cooperation.${baseTextFooter}`,
          namePart,
          frontendUrl,
        );
      case 'false_or_misleading_information':
        return this.buildTemplate(
          'False or Misleading Information',
          `Hello${namePart},\n\nYour rental listing could not be validated because it contains false or misleading information (e.g., tool condition, features, brand, availability).\nTo ensure the reliability and safety of our platform, all listings must reflect accurate and verifiable information.\nPlease correct the relevant data and resubmit your listing.\nWe thank you for your understanding and remain available for any questions.${baseTextFooter}`,
          `Hello${namePart},\n\nYour rental listing could not be validated because it contains false or misleading information (e.g., tool condition, features, brand, availability).\nTo ensure the reliability and safety of our platform, all listings must reflect accurate and verifiable information.\nPlease correct the relevant data and resubmit your listing.\nWe thank you for your understanding and remain available for any questions.${baseTextFooter}`,
          namePart,
          frontendUrl,
        );
      default:
        // Fallback template
        return this.buildTemplate(
          'Listing Rejected',
          `Hello${namePart},\n\nYour rental listing has been rejected during moderation.\nReason: ${reason}.\nYou can correct your listing and resubmit it from your tools area.${baseTextFooter}`,
          `Hello${namePart},\n\nYour rental listing has been rejected during moderation.\nReason: ${reason}.\nYou can correct your listing and resubmit it from your tools area.${baseTextFooter}`,
          namePart,
          frontendUrl,
        );
    }
  }

  private normalizeReason(reason: string): ToolRejectionReasonKey | 'other' {
    const r = (reason || '').toLowerCase();
    // French keywords
    if (r.includes('incomplet')) return 'incomplete_information';
    if (r.includes('prix') || r.includes('tarif') || r.includes('non conforme'))
      return 'non_compliant_price';
    if (r.includes('photo') || r.includes('image'))
      return 'poor_quality_photos';
    if (r.includes('description') || r.includes('insuffisant'))
      return 'insufficient_description';
    if (
      r.includes('inapproprié') ||
      r.includes('inapproprie') ||
      r.includes('contenu')
    )
      return 'inappropriate_content';
    if (
      r.includes('fausse') ||
      r.includes('trompeuse') ||
      r.includes('mensong') ||
      r.includes('faux')
    )
      return 'false_or_misleading_information';
    // English keywords
    if (r.includes('incomplete information')) return 'incomplete_information';
    if (
      r.includes('non-compliant price') ||
      (r.includes('price') && r.includes('non-compliant'))
    )
      return 'non_compliant_price';
    if (
      r.includes('poor quality photo') ||
      r.includes('poor quality photos') ||
      r.includes('photo quality')
    )
      return 'poor_quality_photos';
    if (r.includes('insufficient description'))
      return 'insufficient_description';
    if (r.includes('inappropriate content')) return 'inappropriate_content';
    if (
      r.includes('false or misleading') ||
      r.includes('misleading information') ||
      r.includes('false information')
    )
      return 'false_or_misleading_information';
    return 'other';
  }

  private buildTemplate(
    subject: string,
    textBody: string,
    textAlt: string,
    namePart: string,
    frontendUrl: string,
  ): ToolRejectionEmailTemplate {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>${subject}</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #dc3545; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { padding: 20px; background: #f9f9f9; border-radius: 0 0 8px 8px; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
          a { color: #0d6efd; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>${subject}</h1>
          </div>
          <div class="content">
            <p>${textBody.replace(/\n/g, '<br/>')}</p>
           
            <p>Sincerely,<br/>The BricolaLTD Team</p>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} BricolaLTD. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
    const text = textAlt;
    return { subject, html, text };
  }
}
