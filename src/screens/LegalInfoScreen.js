import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Screen from '../components/Screen';
import Card from '../components/Card';
import { colors } from '../theme/colors';

const CONTENT = {
  PrivacyPolicy: {
    title: 'Privacy Policy',
    updated: 'Last updated: September 16, 2026',
    sections: [
      ['Information we collect', 'Coop stores information you provide to use the app, such as account details, family or household membership, profile names and photos, chores, point balances, rewards, and chore proof photos. Authentication and app data are handled through Firebase services.'],
      ['How we use information', 'We use this information to provide Coop’s features, keep family accounts connected, assign and track chores, calculate points and rewards, display profile information, maintain app security, and troubleshoot or support the service.'],
      ['Children and family accounts', 'Coop is designed for use by families. Parents or guardians should supervise a child’s use of the app and should only create or permit accounts and content they are authorized to manage.'],
      ['Sharing and service providers', 'We do not sell personal information. Information may be processed by service providers used to operate Coop, including Firebase and related hosting, authentication, database, storage, and cloud-function services. We may also disclose information when required by law or to protect users and the service.'],
      ['Data retention and deletion', 'Information is kept while it is needed to provide the service. Users can delete their profile from the app. Some information may remain temporarily in backups, logs, or records where retention is reasonably necessary for security, legal, or technical purposes.'],
      ['Security', 'We use reasonable technical safeguards, including authenticated access and Firebase security rules. No online service can guarantee absolute security, so avoid uploading sensitive information that is not needed for Coop.'],
      ['Your choices', 'You may update your profile information in the app and may delete your profile using the profile settings. You can also contact support with privacy questions or requests.'],
      ['Contact', 'Questions about this Privacy Policy can be sent to jaxonwebster4@gmail.com.'],
    ],
  },
  TermsOfUse: {
    title: 'Terms of Use',
    updated: 'Last updated: September 16, 2026',
    sections: [
      ['Using Coop', 'Coop is a family chore and rewards application. You agree to use it lawfully and only for accounts, households, content, and information you are authorized to access or manage.'],
      ['Parent and guardian responsibility', 'Parents and guardians are responsible for deciding whether and how children use Coop, creating appropriate chores and rewards, supervising account activity, and obtaining any consent required for a child’s use of the service.'],
      ['Accounts and security', 'You are responsible for keeping your sign-in credentials secure and for activity performed through your account. Do not attempt to access another household or interfere with the app, its security, or its infrastructure.'],
      ['Chores, points, and rewards', 'Points and rewards in Coop are tools for family organization. They have no cash value unless a family independently chooses to provide a real-world reward. Coop is not responsible for promises, disputes, purchases, injuries, or other arrangements between family members.'],
      ['User content', 'You are responsible for names, photos, chore descriptions, proof photos, and other content you upload. Do not upload unlawful, harmful, infringing, or private content that you do not have permission to use.'],
      ['Availability and changes', 'The app may change, experience interruptions, or have features added or removed. We may update these Terms as the service evolves. Continued use after an update means you accept the revised Terms.'],
      ['Disclaimer and liability', 'Coop is provided on an “as is” and “as available” basis to the extent permitted by law. We do not guarantee uninterrupted or error-free operation. To the extent permitted by law, the developer is not liable for indirect, incidental, special, or consequential losses arising from use of the app.'],
      ['Contact', 'Questions about these Terms can be sent to jaxonwebster4@gmail.com.'],
    ],
  },
  FAQs: {
    title: 'FAQs',
    updated: 'Common questions about Coop',
    sections: [
      ['How does Coop work?', 'Parents create chores, assign them to family members, and choose a point value. Kids complete chores to earn points that can be used toward family rewards.'],
      ['How do recurring chores work?', 'When a parent marks a chore as recurring, Coop creates new occurrences on the selected schedule. The app checks for the current day’s scheduled chores when the household chore list loads.'],
      ['Why is a completed chore waiting for approval?', 'If a chore requires parent approval, completing it submits it for review. Points are awarded after a parent approves it.'],
      ['Can a chore be available to anyone?', 'Yes. A parent can make a chore available instead of assigning it to one person. A family member can then claim it.'],
      ['How do profile pictures work?', 'Open Profile, choose Settings, then Edit profile. Tap the profile picture area, select an image, and save. Photo-library permission and Firebase Storage must be enabled.'],
      ['What happens if I delete my profile?', 'Profile deletion is permanent for that sign-in account. Make sure you no longer need the account before confirming deletion.'],
      ['I found a problem or need help. What should I do?', 'Use Contact support in the Profile settings menu to start an email to jaxonwebster4@gmail.com. Include what you were doing and any error message you saw.'],
    ],
  },
};

export default function LegalInfoScreen({ route }) {
  const page = CONTENT[route.params?.page] || CONTENT.FAQs;
  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.title}>{page.title}</Text>
        <Text style={styles.updated}>{page.updated}</Text>
      </View>
      {page.sections.map(([heading, body]) => (
        <Card key={heading}>
          <Text style={styles.heading}>{heading}</Text>
          <Text style={styles.body}>{body}</Text>
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: 6 },
  title: { fontSize: 30, lineHeight: 38, fontWeight: '900', color: colors.charcoal },
  updated: { fontSize: 14, color: colors.gray500 },
  heading: { fontSize: 17, fontWeight: '800', color: colors.charcoal, marginBottom: 8 },
  body: { fontSize: 15, lineHeight: 23, color: colors.gray500 },
});
