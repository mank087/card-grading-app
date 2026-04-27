import { useState } from 'react'
import { View, Text, TextInput, StyleSheet, ScrollView, Alert, KeyboardAvoidingView, Platform } from 'react-native'
import { useAuth } from '@/contexts/AuthContext'
import { Colors } from '@/lib/constants'
import Button from '@/components/ui/Button'

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'https://dcmgrading.com'

export default function ContactPage() {
  const { user } = useAuth()
  const [name, setName] = useState('')
  const [email, setEmail] = useState(user?.email || '')
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [sent, setSent] = useState(false)

  const handleSubmit = async () => {
    if (!name.trim() || !email.trim() || !subject.trim() || !message.trim()) {
      Alert.alert('Missing Fields', 'Please fill in all fields.')
      return
    }

    setIsSubmitting(true)
    try {
      const response = await fetch(`${API_BASE}/api/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), subject: subject.trim(), message: message.trim() }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to send message')
      }

      setSent(true)
      setName('')
      setSubject('')
      setMessage('')
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to send. Please try admin@dcmgrading.com directly.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (sent) {
    return (
      <View style={styles.successContainer}>
        <Text style={styles.successIcon}>✓</Text>
        <Text style={styles.successTitle}>Message Sent!</Text>
        <Text style={styles.successText}>We'll get back to you as soon as possible at {email}</Text>
        <Button title="Send Another" variant="secondary" onPress={() => setSent(false)} style={{ marginTop: 16 }} />
      </View>
    )
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Contact Us</Text>
        <Text style={styles.subtitle}>Have a question or need help? Send us a message and we'll respond via email.</Text>

        <Text style={styles.label}>Name</Text>
        <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Your name" placeholderTextColor={Colors.gray[400]} />

        <Text style={styles.label}>Email</Text>
        <TextInput style={styles.input} value={email} onChangeText={setEmail} placeholder="your@email.com" placeholderTextColor={Colors.gray[400]} keyboardType="email-address" autoCapitalize="none" />

        <Text style={styles.label}>Subject</Text>
        <TextInput style={styles.input} value={subject} onChangeText={setSubject} placeholder="What's this about?" placeholderTextColor={Colors.gray[400]} />

        <Text style={styles.label}>Message</Text>
        <TextInput
          style={[styles.input, styles.messageInput]}
          value={message}
          onChangeText={setMessage}
          placeholder="Tell us more..."
          placeholderTextColor={Colors.gray[400]}
          multiline
          maxLength={2000}
          textAlignVertical="top"
        />
        <Text style={styles.charCount}>{message.length}/2000</Text>

        <Button title={isSubmitting ? 'Sending...' : 'Send Message'} onPress={handleSubmit} loading={isSubmitting} disabled={isSubmitting} style={{ marginTop: 8 }} />

        <Text style={styles.directEmail}>Or email us directly: admin@dcmgrading.com</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.gray[50] },
  content: { padding: 20, paddingBottom: 40 },
  title: { fontSize: 24, fontWeight: '800', color: Colors.gray[900], marginBottom: 4 },
  subtitle: { fontSize: 14, color: Colors.gray[500], marginBottom: 20 },
  label: { fontSize: 14, fontWeight: '600', color: Colors.gray[700], marginBottom: 6, marginTop: 12 },
  input: { backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.gray[300], borderRadius: 10, padding: 14, fontSize: 16, color: Colors.gray[900] },
  messageInput: { minHeight: 120 },
  charCount: { fontSize: 11, color: Colors.gray[400], textAlign: 'right', marginTop: 4 },
  directEmail: { fontSize: 13, color: Colors.gray[500], textAlign: 'center', marginTop: 20 },
  successContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, backgroundColor: Colors.gray[50] },
  successIcon: { fontSize: 48, color: Colors.green[600], marginBottom: 12 },
  successTitle: { fontSize: 24, fontWeight: '800', color: Colors.gray[900] },
  successText: { fontSize: 14, color: Colors.gray[500], textAlign: 'center', marginTop: 8 },
})
