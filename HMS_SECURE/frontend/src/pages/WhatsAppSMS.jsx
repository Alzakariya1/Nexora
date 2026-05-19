import React from 'react';
import EnterpriseFeatureWorkspace from './EnterpriseFeatureWorkspace.jsx';
import Communications from './Communications.jsx';

export default function WhatsAppSMS({ currentHospital }) {
  return <>
    <EnterpriseFeatureWorkspace
      featureKey="whatsapp_sms"
      title="WhatsApp/SMS"
      eyebrow="PATIENT COMMUNICATIONS"
      currentHospital={currentHospital}
      description="Configure WhatsApp/SMS provider readiness, templates, reminders, consent evidence and message delivery logs."
      primaryRecord="template"
      recordTypes={['provider','template','consent','reminder_rule','delivery_test','evidence']}
      fields={[{key:'channel',label:'Channel',type:'select',options:['whatsapp','sms','email','in_app']},{key:'provider',label:'Provider',placeholder:'Twilio/Gupshup/MSG91/etc.'},{key:'template_id',label:'Template ID',placeholder:'Approved provider template id'}]}
      checklist={['Provider settings captured','Approved message templates tracked','Patient consent evidence available','Reminder rules recorded','Delivery logs auditable']}
    />
    <div className="enterprise-feature-page"><Communications /></div>
  </>;
}
