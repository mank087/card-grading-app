import { useState, useRef, useEffect } from 'react'
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, Animated, Keyboard, KeyboardAvoidingView, Platform } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Colors } from '@/lib/constants'

// ── Knowledge Base (inline — same Q&A as web helpbot) ──

interface KBEntry { id: string; q: string; a: string; keywords: string[]; cat: string }

const CATEGORIES = [
  { id: 'getting-started', label: 'Getting Started', emoji: '🚀' },
  { id: 'grading', label: 'Grading & Scores', emoji: '📊' },
  { id: 'photos', label: 'Photo Tips', emoji: '📷' },
  { id: 'pricing', label: 'Pricing & Credits', emoji: '💳' },
  { id: 'labels', label: 'Labels & Reports', emoji: '🏷️' },
  { id: 'account', label: 'Account Help', emoji: '👤' },
]

const KB: KBEntry[] = [
  { id: '1', q: 'What is DCM Grading?', a: 'DCM Grading is an AI-powered card grading service. Upload front and back photos, and our DCM Optic™ system delivers a professional grade in under 60 seconds.', keywords: ['what', 'dcm', 'about'], cat: 'getting-started' },
  { id: '2', q: 'How does grading work?', a: 'Upload front and back photos → our 3-pass AI consensus system evaluates centering, corners, edges, and surface → you get a grade 1-10 with detailed subgrades.', keywords: ['how', 'work', 'process'], cat: 'getting-started' },
  { id: '3', q: 'What card types are supported?', a: 'Pokemon, Sports (Baseball, Football, Basketball, Hockey, Soccer), Magic: The Gathering, Lorcana, One Piece, Yu-Gi-Oh, Star Wars, Marvel, and more under "Other".', keywords: ['cards', 'types', 'supported', 'pokemon', 'sports'], cat: 'getting-started' },
  { id: '4', q: 'How much does grading cost?', a: 'Basic: $2.99/1 card, Pro: $9.99/5 cards, Elite: $19.99/20 cards, VIP: $99/150 cards. Founders and Card Lovers get 20% off.', keywords: ['cost', 'price', 'credits', 'how much'], cat: 'pricing' },
  { id: '5', q: 'How do I take good photos?', a: 'Use good even lighting (natural light works best), hold phone directly overhead, fill the frame with the card, avoid flash, and place card on a contrasting flat surface.', keywords: ['photo', 'picture', 'camera', 'tips', 'lighting'], cat: 'photos' },
  { id: '6', q: 'What do the grades mean?', a: '10 = Gem Mint, 9 = Mint, 8 = Near Mint-Mint, 7 = Near Mint, 6 = Excellent, 5 = Very Good-Excellent. The grade is determined by the weakest subgrade (centering, corners, edges, surface).', keywords: ['grade', 'mean', 'scale', 'score'], cat: 'grading' },
  { id: '7', q: 'How is the final grade calculated?', a: 'The final grade equals your lowest subgrade (weakest link principle). If centering=10, corners=10, edges=10, surface=8, your final grade is 8.', keywords: ['calculate', 'final', 'weakest', 'formula'], cat: 'grading' },
  { id: '8', q: 'What are subgrades?', a: 'Each card gets 4 subgrades: Centering (border alignment), Corners (sharpness/wear), Edges (whitening/chips), and Surface (scratches/gloss). Each scored 1-10.', keywords: ['subgrade', 'centering', 'corners', 'edges', 'surface'], cat: 'grading' },
  { id: '9', q: 'How do I print labels?', a: 'Go to Label Studio from your collection or menu. Choose label type (slab, top loader, one-touch, fold-over), customize colors and text, then download/print.', keywords: ['print', 'label', 'slab', 'studio'], cat: 'labels' },
  { id: '10', q: 'Can I sell graded cards on eBay?', a: 'Yes! Use the Insta-List to eBay feature on any card detail page. It auto-fills the listing with your card images, DCM grade, and condition description.', keywords: ['ebay', 'sell', 'list', 'marketplace'], cat: 'labels' },
  { id: '11', q: 'How do I change my password?', a: 'Go to Menu > My Account > Change Password. You\'ll need your current password to set a new one.', keywords: ['password', 'change', 'reset', 'account'], cat: 'account' },
  { id: '12', q: 'How do I delete my account?', a: 'Go to Menu > My Account > scroll to bottom > Delete Account. This action is permanent and removes all your data.', keywords: ['delete', 'account', 'remove'], cat: 'account' },
  { id: '13', q: 'What is the confidence score?', a: 'The confidence score (A/B/C/D) reflects image quality. A = excellent visibility, D = poor. Low confidence increases grade uncertainty but does NOT lower the grade itself.', keywords: ['confidence', 'score', 'image quality', 'A B C D'], cat: 'grading' },
  { id: '14', q: 'What is Card Lovers?', a: 'Card Lovers is a subscription plan ($49.99/mo or $449/yr) that includes credits, 20% off purchases, market pricing access, and exclusive features.', keywords: ['card lovers', 'subscription', 'monthly'], cat: 'pricing' },
  { id: '15', q: 'How do I contact support?', a: 'Go to Menu > Contact Us, or email admin@dcmgrading.com directly. We respond within 24 hours.', keywords: ['contact', 'support', 'help', 'email'], cat: 'account' },
]

function searchKB(query: string): KBEntry[] {
  const q = query.toLowerCase()
  const words = q.split(/\s+/).filter(w => w.length > 2)
  return KB.filter(entry => {
    const matchKeyword = entry.keywords.some(kw => words.some(w => kw.includes(w) || w.includes(kw)))
    const matchQuestion = words.some(w => entry.q.toLowerCase().includes(w))
    return matchKeyword || matchQuestion
  }).slice(0, 3)
}

// ── Message Types ──

interface Message {
  id: string
  role: 'bot' | 'user'
  text: string
  buttons?: { label: string; action: string }[]
}

let msgId = 0
const nextMsgId = () => `m${++msgId}`

// ── Component ──

export default function HelpBot() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const slideAnim = useRef(new Animated.Value(0)).current
  const pulseAnim = useRef(new Animated.Value(1)).current
  const listRef = useRef<FlatList>(null)

  // Pulse animation on button
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.1, duration: 1500, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
      ])
    )
    pulse.start()
    return () => pulse.stop()
  }, [])

  const open = () => {
    if (messages.length === 0) {
      setMessages([{
        id: nextMsgId(),
        role: 'bot',
        text: "Hi! I'm the DCM HelpBot. Pick a topic or type your question.",
        buttons: CATEGORIES.map(c => ({ label: `${c.emoji} ${c.label}`, action: `cat:${c.id}` })),
      }])
    }
    setIsOpen(true)
    Animated.spring(slideAnim, { toValue: 1, friction: 8, tension: 65, useNativeDriver: true }).start()
  }

  const close = () => {
    Animated.timing(slideAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => setIsOpen(false))
    Keyboard.dismiss()
  }

  const addMsg = (msg: Message) => {
    setMessages(prev => [...prev, msg])
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100)
  }

  const handleCategoryTap = (catId: string) => {
    const cat = CATEGORIES.find(c => c.id === catId)
    addMsg({ id: nextMsgId(), role: 'user', text: cat?.label || catId })

    const entries = KB.filter(e => e.cat === catId)
    if (entries.length > 0) {
      addMsg({
        id: nextMsgId(),
        role: 'bot',
        text: `Here are common questions about ${cat?.label}:`,
        buttons: entries.map(e => ({ label: e.q, action: `ans:${e.id}` })),
      })
    } else {
      addMsg({ id: nextMsgId(), role: 'bot', text: "I don't have specific answers in that category yet. Try typing your question or contact us at admin@dcmgrading.com." })
    }
  }

  const handleAnswerTap = (entryId: string) => {
    const entry = KB.find(e => e.id === entryId)
    if (entry) {
      addMsg({ id: nextMsgId(), role: 'user', text: entry.q })
      addMsg({ id: nextMsgId(), role: 'bot', text: entry.a })
    }
  }

  const handleSend = () => {
    const q = input.trim()
    if (!q) return
    setInput('')
    Keyboard.dismiss()

    addMsg({ id: nextMsgId(), role: 'user', text: q })

    const results = searchKB(q)
    if (results.length > 0) {
      addMsg({
        id: nextMsgId(),
        role: 'bot',
        text: results.length === 1 ? results[0].a : "Here's what I found:",
        buttons: results.length > 1 ? results.map(r => ({ label: r.q, action: `ans:${r.id}` })) : undefined,
      })
    } else {
      addMsg({
        id: nextMsgId(),
        role: 'bot',
        text: "I couldn't find a match. Try rephrasing or contact our team.",
        buttons: [
          { label: '📧 Contact Support', action: 'nav:contact' },
          { label: '🏠 Back to Topics', action: 'home' },
        ],
      })
    }
  }

  const handleButtonPress = (action: string) => {
    if (action.startsWith('cat:')) handleCategoryTap(action.slice(4))
    else if (action.startsWith('ans:')) handleAnswerTap(action.slice(4))
    else if (action === 'home') {
      addMsg({
        id: nextMsgId(),
        role: 'bot',
        text: 'Pick a topic:',
        buttons: CATEGORIES.map(c => ({ label: `${c.emoji} ${c.label}`, action: `cat:${c.id}` })),
      })
    }
    else if (action.startsWith('nav:')) {
      close()
      router.push(`/pages/${action.slice(4)}` as any)
    }
  }

  const translateY = slideAnim.interpolate({ inputRange: [0, 1], outputRange: [600, 0] })

  return (
    <>
      {/* Floating Button */}
      {!isOpen && (
        <Animated.View style={[styles.fab, { bottom: insets.bottom + 70, transform: [{ scale: pulseAnim }] }]}>
          <TouchableOpacity style={styles.fabButton} onPress={open} activeOpacity={0.8}>
            <Ionicons name="chatbubble-ellipses" size={26} color={Colors.white} />
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* Chat Panel */}
      {isOpen && (
        <Animated.View style={[styles.panel, { bottom: insets.bottom + 70, transform: [{ translateY }] }]}>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={100}>
            {/* Header */}
            <View style={styles.panelHeader}>
              <View style={styles.panelHeaderLeft}>
                <View style={styles.botAvatar}>
                  <Ionicons name="chatbubble-ellipses" size={16} color={Colors.white} />
                </View>
                <Text style={styles.panelTitle}>DCM HelpBot</Text>
              </View>
              <TouchableOpacity onPress={close} style={styles.closeBtn}>
                <Ionicons name="close" size={22} color={Colors.gray[500]} />
              </TouchableOpacity>
            </View>

            {/* Messages */}
            <FlatList
              ref={listRef}
              data={messages}
              keyExtractor={m => m.id}
              contentContainerStyle={styles.messageList}
              renderItem={({ item }) => (
                <View style={[styles.msgRow, item.role === 'user' && styles.msgRowUser]}>
                  <View style={[styles.msgBubble, item.role === 'user' ? styles.msgUser : styles.msgBot]}>
                    <Text style={[styles.msgText, item.role === 'user' && styles.msgTextUser]}>{item.text}</Text>
                  </View>
                  {item.buttons && (
                    <View style={styles.btnGrid}>
                      {item.buttons.map((btn, i) => (
                        <TouchableOpacity key={i} style={styles.topicBtn} onPress={() => handleButtonPress(btn.action)} activeOpacity={0.7}>
                          <Text style={styles.topicBtnText}>{btn.label}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>
              )}
            />

            {/* Input */}
            <View style={styles.inputRow}>
              <TextInput
                style={styles.chatInput}
                value={input}
                onChangeText={setInput}
                placeholder="Type your question..."
                placeholderTextColor={Colors.gray[400]}
                onSubmitEditing={handleSend}
                returnKeyType="send"
              />
              <TouchableOpacity style={styles.sendBtn} onPress={handleSend} disabled={!input.trim()}>
                <Ionicons name="send" size={20} color={input.trim() ? Colors.purple[600] : Colors.gray[300]} />
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </Animated.View>
      )}
    </>
  )
}

const styles = StyleSheet.create({
  // FAB
  fab: { position: 'absolute', right: 16, zIndex: 1000 },
  fabButton: { width: 56, height: 56, borderRadius: 28, backgroundColor: Colors.purple[600], alignItems: 'center', justifyContent: 'center', shadowColor: Colors.purple[600], shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 8 },

  // Panel
  panel: { position: 'absolute', left: 12, right: 12, height: 420, backgroundColor: Colors.white, borderRadius: 16, shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 20, zIndex: 1000, overflow: 'hidden' },
  panelHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.gray[200], backgroundColor: Colors.gray[50] },
  panelHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  botAvatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.purple[600], alignItems: 'center', justifyContent: 'center' },
  panelTitle: { fontSize: 15, fontWeight: '700', color: Colors.gray[900] },
  closeBtn: { padding: 4 },

  // Messages
  messageList: { padding: 12, paddingBottom: 4 },
  msgRow: { marginBottom: 8 },
  msgRowUser: { alignItems: 'flex-end' },
  msgBubble: { maxWidth: '85%', padding: 10, borderRadius: 12 },
  msgBot: { backgroundColor: Colors.gray[100], borderBottomLeftRadius: 4 },
  msgUser: { backgroundColor: Colors.purple[600], borderBottomRightRadius: 4 },
  msgText: { fontSize: 14, color: Colors.gray[800], lineHeight: 20 },
  msgTextUser: { color: Colors.white },

  // Topic buttons
  btnGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6, maxWidth: '85%' },
  topicBtn: { backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.purple[200], borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6 },
  topicBtnText: { fontSize: 12, color: Colors.purple[700], fontWeight: '500' },

  // Input
  inputRow: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: Colors.gray[200], paddingHorizontal: 12, paddingVertical: 8, backgroundColor: Colors.white },
  chatInput: { flex: 1, fontSize: 15, color: Colors.gray[900], paddingVertical: 8, paddingHorizontal: 8 },
  sendBtn: { padding: 8, minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
})
