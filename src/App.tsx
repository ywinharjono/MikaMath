import React, { useState, useEffect, useRef } from 'react';
import { auth, db, googleProvider, handleFirestoreError, OperationType } from './firebase';
import { signInWithPopup, onAuthStateChanged, signOut, User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc, setDoc, collection, query, where, onSnapshot, addDoc, serverTimestamp, orderBy, limit } from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  BookOpen, 
  Brain, 
  MessageCircle, 
  User as UserIcon, 
  LogOut, 
  Star, 
  Trophy, 
  ChevronRight, 
  Calculator, 
  Triangle, 
  Variable,
  Send,
  X,
  Loader2,
  Settings,
  BarChart3
} from 'lucide-react';
import { cn } from './lib/utils';
import { GoogleGenAI } from "@google/genai";
import ReactMarkdown from 'react-markdown';

// --- Types ---
interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  role: 'parent' | 'child';
  childName?: string;
  unlockedCharacters?: string[];
  badges?: string[];
  createdAt: any;
}

interface Progress {
  userId: string;
  subject: string;
  level: number;
  score: number;
  lastUpdated: any;
}

interface ChatMessage {
  id?: string;
  userId: string;
  role: 'user' | 'model';
  content: string;
  timestamp: any;
}

// --- AI Tutor Configuration ---
const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

// --- Constants ---
const BADGES = [
  { id: 'arithmetic_master', title: 'Jago Hitung', icon: Calculator, color: 'blue', description: 'Selesaikan 5 misi Aritmatika' },
  { id: 'algebra_wizard', title: 'Penyihir Aljabar', icon: Variable, color: 'orange', description: 'Selesaikan 5 misi Aljabar' },
  { id: 'geometry_explorer', title: 'Penjelajah Ruang', icon: Triangle, color: 'green', description: 'Selesaikan 5 misi Bangun Ruang' },
  { id: 'math_hero', title: 'Pahlawan Matematika', icon: Trophy, color: 'yellow', description: 'Kumpulkan 100 poin' },
];

const CHARACTERS = [
  { id: 'kiko', name: 'Kiko', image: 'https://picsum.photos/seed/robot/200/200', description: 'Tutor robot yang pintar dan ramah.' },
  { id: 'momo', name: 'Momo', image: 'https://picsum.photos/seed/monkey/200/200', description: 'Monyet ceria yang suka menghitung pisang.' },
  { id: 'lulu', name: 'Lulu', image: 'https://picsum.photos/seed/owl/200/200', description: 'Burung hantu bijak ahli geometri.' },
];

// --- Components ---

const RewardModal = ({ type, item, onClose }: { type: 'badge' | 'character', item: any, onClose: () => void }) => (
  <motion.div 
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-center justify-center p-4"
  >
    <motion.div 
      initial={{ scale: 0.5, rotate: -10 }}
      animate={{ scale: 1, rotate: 0 }}
      className="bg-white rounded-[40px] p-8 max-w-sm w-full text-center relative overflow-hidden"
    >
      <div className="absolute inset-0 bg-gradient-to-b from-yellow-100/50 to-transparent pointer-events-none" />
      
      <motion.div 
        animate={{ y: [0, -10, 0] }}
        transition={{ repeat: Infinity, duration: 2 }}
        className="relative z-10 mb-6"
      >
        {type === 'badge' ? (
          <div className={cn("w-32 h-32 mx-auto rounded-full flex items-center justify-center shadow-xl border-8 border-white", 
            item.color === 'blue' ? "bg-blue-500" : item.color === 'orange' ? "bg-orange-500" : item.color === 'green' ? "bg-green-500" : "bg-yellow-500"
          )}>
            <item.icon className="w-16 h-16 text-white" />
          </div>
        ) : (
          <img src={item.image} alt={item.name} className="w-32 h-32 mx-auto rounded-full border-8 border-white shadow-xl object-cover" referrerPolicy="no-referrer" />
        )}
      </motion.div>

      <h2 className="text-3xl font-bold text-gray-800 mb-2">Selamat! 🎉</h2>
      <p className="text-gray-600 mb-6">
        Kamu baru saja mendapatkan {type === 'badge' ? 'Lencana' : 'Teman Baru'}:<br/>
        <span className="text-xl font-bold text-blue-600">{item.title || item.name}</span>
      </p>

      <button 
        onClick={onClose}
        className="w-full bg-blue-500 text-white font-bold py-4 rounded-2xl shadow-lg hover:bg-blue-600 transition-all active:scale-95"
      >
        Keren! Lanjutkan!
      </button>

      {/* Confetti-like particles */}
      {[...Array(24)].map((_, i) => (
        <motion.div
          key={i}
          initial={{ x: 0, y: 0, opacity: 1 }}
          animate={{ 
            x: (Math.random() - 0.5) * 600, 
            y: (Math.random() - 0.5) * 600,
            opacity: 0,
            rotate: 720,
            scale: [1, 1.5, 0]
          }}
          transition={{ duration: 2, ease: "easeOut", delay: Math.random() * 0.2 }}
          className="absolute top-1/2 left-1/2 w-3 h-3 rounded-sm z-0"
          style={{ backgroundColor: ['#3B82F6', '#F59E0B', '#10B981', '#EF4444', '#8B5CF6'][i % 5] }}
        />
      ))}
    </motion.div>
  </motion.div>
);

const CollectionView = ({ profile, onClose }: { profile: UserProfile, onClose: () => void }) => (
  <motion.div 
    initial={{ x: '100%' }}
    animate={{ x: 0 }}
    exit={{ x: '100%' }}
    className="fixed inset-0 bg-yellow-50 z-50 flex flex-col"
  >
    <header className="p-6 bg-white flex items-center justify-between shadow-sm">
      <h2 className="text-2xl font-bold text-blue-600">Koleksi Hebatku</h2>
      <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full">
        <X className="w-8 h-8" />
      </button>
    </header>

    <div className="flex-1 overflow-y-auto p-6 space-y-8">
      <section>
        <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
          <Trophy className="text-yellow-500" />
          Lencana Penghargaan
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {BADGES.map(badge => {
            const isEarned = profile.badges?.includes(badge.id);
            return (
              <div key={badge.id} className={cn(
                "p-4 rounded-3xl text-center flex flex-col items-center gap-2 border-4 transition-all",
                isEarned ? "bg-white border-yellow-200 shadow-md" : "bg-gray-100 border-transparent opacity-40 grayscale"
              )}>
                <div className={cn("w-16 h-16 rounded-full flex items-center justify-center", 
                  isEarned ? (badge.color === 'blue' ? "bg-blue-500" : badge.color === 'orange' ? "bg-orange-500" : badge.color === 'green' ? "bg-green-500" : "bg-yellow-500") : "bg-gray-300"
                )}>
                  <badge.icon className="w-8 h-8 text-white" />
                </div>
                <p className="font-bold text-sm leading-tight">{badge.title}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
          <Star className="text-blue-500" />
          Teman Belajar (Karakter)
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {CHARACTERS.map(char => {
            const isUnlocked = profile.unlockedCharacters?.includes(char.id) || char.id === 'kiko';
            return (
              <div key={char.id} className={cn(
                "p-4 rounded-3xl flex items-center gap-4 border-4 transition-all",
                isUnlocked ? "bg-white border-blue-100 shadow-md" : "bg-gray-100 border-transparent opacity-40 grayscale"
              )}>
                <img src={char.image} alt={char.name} className="w-16 h-16 rounded-2xl object-cover" referrerPolicy="no-referrer" />
                <div>
                  <p className="font-bold text-lg">{char.name}</p>
                  <p className="text-xs text-gray-500">{isUnlocked ? char.description : 'Selesaikan misi untuk buka!'}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  </motion.div>
);

const LoadingScreen = () => (
  <div className="fixed inset-0 flex flex-col items-center justify-center bg-yellow-50 z-50">
    <motion.div
      animate={{ rotate: 360 }}
      transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
      className="mb-4"
    >
      <Brain className="w-16 h-16 text-blue-500" />
    </motion.div>
    <h2 className="text-2xl font-bold text-blue-600 font-sans tracking-tight">Menyiapkan Petualangan...</h2>
  </div>
);

const Auth = ({ onAuthSuccess }: { onAuthSuccess: (user: FirebaseUser) => void }) => {
  const handleLogin = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      onAuthSuccess(result.user);
    } catch (error) {
      console.error("Login failed:", error);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-400 via-purple-400 to-pink-400 p-4">
      <motion.div 
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white p-8 rounded-3xl shadow-2xl max-w-md w-full text-center border-4 border-white/50"
      >
        <div className="bg-yellow-100 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
          <Brain className="w-12 h-12 text-yellow-600" />
        </div>
        <h1 className="text-4xl font-bold text-blue-600 mb-2 font-sans tracking-tight">MathKiddo</h1>
        <p className="text-gray-600 mb-8 text-lg">Petualangan Matematika Seru untuk Anak Hebat!</p>
        
        <button
          onClick={handleLogin}
          className="w-full flex items-center justify-center gap-3 bg-white border-2 border-gray-200 text-gray-700 font-bold py-4 px-6 rounded-2xl hover:bg-gray-50 transition-all shadow-md active:scale-95"
        >
          <img src="https://www.google.com/favicon.ico" alt="Google" className="w-6 h-6" />
          Masuk dengan Google
        </button>
        
        <p className="mt-6 text-sm text-gray-400 italic">
          Orang tua dapat memantau perkembangan belajar anak
        </p>
      </motion.div>
    </div>
  );
};

const RoleSelection = ({ user, onRoleSelected }: { user: FirebaseUser, onRoleSelected: (role: 'parent' | 'child', childName?: string) => void }) => {
  const [selectedRole, setSelectedRole] = useState<'parent' | 'child' | null>(null);
  const [childName, setChildName] = useState('');

  return (
    <div className="min-h-screen flex items-center justify-center bg-blue-50 p-4">
      <motion.div 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="bg-white p-8 rounded-3xl shadow-xl max-w-2xl w-full"
      >
        <h2 className="text-3xl font-bold text-center text-blue-600 mb-8">Siapa yang akan belajar hari ini?</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <button
            onClick={() => setSelectedRole('child')}
            className={cn(
              "p-6 rounded-2xl border-4 transition-all flex flex-col items-center gap-4",
              selectedRole === 'child' ? "border-blue-500 bg-blue-50" : "border-gray-100 hover:border-blue-200"
            )}
          >
            <div className="bg-blue-100 p-4 rounded-full">
              <Star className="w-12 h-12 text-blue-500" />
            </div>
            <span className="text-xl font-bold text-blue-700">Anak (Siswa)</span>
          </button>

          <button
            onClick={() => setSelectedRole('parent')}
            className={cn(
              "p-6 rounded-2xl border-4 transition-all flex flex-col items-center gap-4",
              selectedRole === 'parent' ? "border-purple-500 bg-purple-50" : "border-gray-100 hover:border-purple-200"
            )}
          >
            <div className="bg-purple-100 p-4 rounded-full">
              <UserIcon className="w-12 h-12 text-purple-500" />
            </div>
            <span className="text-xl font-bold text-purple-700">Orang Tua</span>
          </button>
        </div>

        {selectedRole === 'parent' && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mt-8">
            <label className="block text-gray-700 font-bold mb-2">Nama Anak Anda:</label>
            <input
              type="text"
              value={childName}
              onChange={(e) => setChildName(e.target.value)}
              placeholder="Contoh: Budi"
              className="w-full p-4 rounded-xl border-2 border-purple-200 focus:border-purple-500 outline-none"
            />
          </motion.div>
        )}

        <button
          disabled={!selectedRole || (selectedRole === 'parent' && !childName)}
          onClick={() => onRoleSelected(selectedRole!, childName)}
          className="w-full mt-8 bg-blue-500 text-white font-bold py-4 rounded-2xl hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg"
        >
          Mulai Petualangan!
        </button>
      </motion.div>
    </div>
  );
};

const ChatBot = ({ userId, onClose }: { userId: string, onClose: () => void }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = query(
      collection(db, 'chats'),
      where('userId', '==', userId),
      orderBy('timestamp', 'asc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ChatMessage));
      setMessages(msgs);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'chats'));

    return () => unsubscribe();
  }, [userId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMsg = input;
    setInput('');
    setIsTyping(true);

    try {
      // Save user message
      await addDoc(collection(db, 'chats'), {
        userId,
        role: 'user',
        content: userMsg,
        timestamp: serverTimestamp()
      });

      // AI Response
      const response = await genAI.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: messages.map(m => ({
          role: m.role,
          parts: [{ text: m.content }]
        })).concat([{ role: 'user', parts: [{ text: userMsg }] }]),
        config: {
          maxOutputTokens: 500,
          systemInstruction: "Kamu adalah Tutor Matematika Virtual yang ramah bernama 'Kiko'. Kamu membimbing anak usia 6-10 tahun. Gunakan bahasa yang sangat sederhana, ceria, dan penuh semangat. Gunakan banyak emoji. Jika anak bertanya tentang matematika, jelaskan dengan analogi benda nyata (seperti permen, apel, atau mainan). Jangan berikan jawaban langsung, tapi bimbing mereka untuk menemukannya. Pahami karakter anak yang sedang belajar."
        }
      });
      
      const responseText = response.text;

      // Save AI message
      await addDoc(collection(db, 'chats'), {
        userId,
        role: 'model',
        content: responseText,
        timestamp: serverTimestamp()
      });
    } catch (error) {
      console.error("Chat error:", error);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <motion.div 
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 100, opacity: 0 }}
      className="fixed bottom-4 right-4 w-full max-w-md bg-white rounded-3xl shadow-2xl border-4 border-blue-200 overflow-hidden z-50 flex flex-col h-[600px]"
    >
      <div className="bg-blue-500 p-4 flex items-center justify-between text-white">
        <div className="flex items-center gap-3">
          <div className="bg-white p-2 rounded-full">
            <Brain className="w-6 h-6 text-blue-500" />
          </div>
          <div>
            <h3 className="font-bold">Kiko si Tutor Pintar</h3>
            <p className="text-xs text-blue-100">Sedang aktif membantu</p>
          </div>
        </div>
        <button onClick={onClose} className="hover:bg-blue-600 p-2 rounded-full transition-colors">
          <X className="w-6 h-6" />
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-blue-50/30">
        {messages.length === 0 && (
          <div className="text-center py-8">
            <p className="text-gray-500 italic">Halo! Ada yang bisa Kiko bantu hari ini? 🌟</p>
          </div>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className={cn("flex", msg.role === 'user' ? "justify-end" : "justify-start")}>
            <div className={cn(
              "max-w-[80%] p-3 rounded-2xl shadow-sm",
              msg.role === 'user' ? "bg-blue-500 text-white rounded-tr-none" : "bg-white text-gray-800 rounded-tl-none border border-gray-100"
            )}>
              <div className="prose prose-sm max-w-none">
                <ReactMarkdown>{msg.content}</ReactMarkdown>
              </div>
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-white p-3 rounded-2xl rounded-tl-none border border-gray-100 flex gap-1">
              <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 0.6 }} className="w-2 h-2 bg-blue-400 rounded-full" />
              <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.2 }} className="w-2 h-2 bg-blue-400 rounded-full" />
              <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.4 }} className="w-2 h-2 bg-blue-400 rounded-full" />
            </div>
          </div>
        )}
      </div>

      <div className="p-4 bg-white border-t border-gray-100 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Tanya Kiko sesuatu..."
          className="flex-1 p-3 bg-gray-100 rounded-xl outline-none focus:ring-2 focus:ring-blue-400"
        />
        <button 
          onClick={handleSend}
          disabled={!input.trim() || isTyping}
          className="bg-blue-500 text-white p-3 rounded-xl hover:bg-blue-600 disabled:opacity-50 transition-all"
        >
          <Send className="w-6 h-6" />
        </button>
      </div>
    </motion.div>
  );
};

const SubjectCard = ({ title, icon: Icon, color, description, onClick }: { title: string, icon: any, color: string, description: string, onClick: () => void }) => (
  <motion.button
    whileHover={{ scale: 1.05, y: -5 }}
    whileTap={{ scale: 0.95 }}
    onClick={onClick}
    className={cn(
      "p-6 rounded-3xl text-left flex flex-col gap-4 shadow-lg border-b-8 transition-all",
      color === 'blue' && "bg-blue-500 border-blue-700 text-white",
      color === 'green' && "bg-green-500 border-green-700 text-white",
      color === 'orange' && "bg-orange-500 border-orange-700 text-white"
    )}
  >
    <div className="bg-white/20 w-16 h-16 rounded-2xl flex items-center justify-center">
      <Icon className="w-10 h-10" />
    </div>
    <div>
      <h3 className="text-2xl font-bold mb-1">{title}</h3>
      <p className="text-white/80 text-sm leading-tight">{description}</p>
    </div>
    <div className="mt-auto flex items-center justify-between">
      <span className="text-sm font-bold bg-white/20 px-3 py-1 rounded-full">Level 1</span>
      <ChevronRight className="w-6 h-6" />
    </div>
  </motion.button>
);

const ParentDashboard = ({ profile, progress }: { profile: UserProfile, progress: Progress[] }) => {
  return (
    <div className="min-h-screen bg-purple-50 p-6">
      <div className="max-w-4xl mx-auto">
        <header className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-purple-800">Laporan Belajar {profile.childName}</h1>
            <p className="text-purple-600">Pantau perkembangan matematika si kecil</p>
          </div>
          <button onClick={() => signOut(auth)} className="flex items-center gap-2 text-purple-700 hover:bg-purple-100 p-2 rounded-xl transition-all">
            <LogOut className="w-6 h-6" />
            Keluar
          </button>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white p-6 rounded-3xl shadow-md border-b-4 border-blue-200">
            <div className="flex items-center gap-3 mb-4">
              <Calculator className="text-blue-500" />
              <h3 className="font-bold text-gray-700">Aritmatika</h3>
            </div>
            <p className="text-3xl font-bold text-blue-600">
              {progress.find(p => p.subject === 'arithmetic')?.score || 0} <span className="text-sm text-gray-400">Poin</span>
            </p>
          </div>
          <div className="bg-white p-6 rounded-3xl shadow-md border-b-4 border-orange-200">
            <div className="flex items-center gap-3 mb-4">
              <Variable className="text-orange-500" />
              <h3 className="font-bold text-gray-700">Aljabar</h3>
            </div>
            <p className="text-3xl font-bold text-orange-600">
              {progress.find(p => p.subject === 'algebra')?.score || 0} <span className="text-sm text-gray-400">Poin</span>
            </p>
          </div>
          <div className="bg-white p-6 rounded-3xl shadow-md border-b-4 border-green-200">
            <div className="flex items-center gap-3 mb-4">
              <Triangle className="text-green-500" />
              <h3 className="font-bold text-gray-700">Bangun Ruang</h3>
            </div>
            <p className="text-3xl font-bold text-green-600">
              {progress.find(p => p.subject === 'geometry')?.score || 0} <span className="text-sm text-gray-400">Poin</span>
            </p>
          </div>
        </div>

        <div className="bg-white p-8 rounded-3xl shadow-md">
          <h3 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
            <BarChart3 className="text-purple-500" />
            Aktivitas Terakhir
          </h3>
          <div className="space-y-4">
            {progress.length === 0 ? (
              <p className="text-center py-8 text-gray-400 italic">Belum ada aktivitas belajar tercatat.</p>
            ) : (
              progress.map((p, i) => (
                <div key={i} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl">
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      "w-12 h-12 rounded-xl flex items-center justify-center",
                      p.subject === 'arithmetic' ? "bg-blue-100 text-blue-600" :
                      p.subject === 'algebra' ? "bg-orange-100 text-orange-600" :
                      "bg-green-100 text-green-600"
                    )}>
                      {p.subject === 'arithmetic' ? <Calculator /> : p.subject === 'algebra' ? <Variable /> : <Triangle />}
                    </div>
                    <div>
                      <p className="font-bold text-gray-800 capitalize">{p.subject}</p>
                      <p className="text-xs text-gray-500">Level {p.level}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-purple-600">+{p.score} Poin</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// --- Main App ---

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [progress, setProgress] = useState<Progress[]>([]);
  const [loading, setLoading] = useState(true);
  const [showChat, setShowChat] = useState(false);
  const [showCollection, setShowCollection] = useState(false);
  const [newReward, setNewReward] = useState<{ type: 'badge' | 'character', item: any } | null>(null);
  const [activeSubject, setActiveSubject] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        // Fetch profile
        const docRef = doc(db, 'users', firebaseUser.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setProfile(docSnap.data() as UserProfile);
        }
        
        // Fetch progress
        const q = query(collection(db, 'progress'), where('userId', '==', firebaseUser.uid));
        onSnapshot(q, (snapshot) => {
          setProgress(snapshot.docs.map(d => d.data() as Progress));
        }, (err) => handleFirestoreError(err, OperationType.LIST, 'progress'));
      } else {
        setUser(null);
        setProfile(null);
        setProgress([]);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleRoleSelected = async (role: 'parent' | 'child', childName?: string) => {
    if (!user) return;
    const newProfile: UserProfile = {
      uid: user.uid,
      displayName: user.displayName || 'User',
      email: user.email || '',
      role,
      childName,
      unlockedCharacters: ['kiko'],
      badges: [],
      createdAt: serverTimestamp()
    };
    
    try {
      await setDoc(doc(db, 'users', user.uid), newProfile);
      setProfile(newProfile);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'users');
    }
  };

  if (loading) return <LoadingScreen />;

  if (!user) return <Auth onAuthSuccess={setUser} />;

  if (!profile) return <RoleSelection user={user} onRoleSelected={handleRoleSelected} />;

  if (profile.role === 'parent') {
    return <ParentDashboard profile={profile} progress={progress} />;
  }

  return (
    <div className="min-h-screen bg-yellow-50 font-sans text-gray-800 pb-24">
      {/* Header */}
      <header className="bg-white p-6 flex items-center justify-between shadow-sm sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <div className="bg-blue-500 p-2 rounded-xl shadow-lg rotate-3">
            <Brain className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-blue-600 tracking-tight">MathKiddo</h1>
            <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">Halo, {profile.displayName}! 👋</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setShowCollection(true)}
            className="hidden md:flex items-center gap-2 bg-yellow-100 px-4 py-2 rounded-full border-2 border-yellow-200 hover:bg-yellow-200 transition-all"
          >
            <Trophy className="w-5 h-5 text-yellow-600" />
            <span className="font-bold text-yellow-700">{progress.reduce((acc, p) => acc + p.score, 0)} Poin</span>
          </button>
          <button onClick={() => signOut(auth)} className="p-2 hover:bg-gray-100 rounded-full transition-all">
            <LogOut className="w-6 h-6 text-gray-400" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto p-6">
        <section className="mb-12">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-gradient-to-r from-blue-500 to-indigo-600 p-8 rounded-[40px] text-white shadow-xl relative overflow-hidden"
          >
            <div className="relative z-10">
              <h2 className="text-4xl font-bold mb-4">Ayo Mulai Petualanganmu! 🚀</h2>
              <p className="text-blue-100 text-lg max-w-md mb-6">Pilih misi matematikamu hari ini dan kumpulkan semua bintangnya!</p>
              <button className="bg-white text-blue-600 font-bold py-3 px-8 rounded-2xl shadow-lg hover:shadow-xl transition-all active:scale-95">
                Lanjutkan Belajar
              </button>
            </div>
            <Star className="absolute -right-8 -bottom-8 w-64 h-64 text-white/10 rotate-12" />
          </motion.div>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <SubjectCard 
            title="Aritmatika"
            icon={Calculator}
            color="blue"
            description="Belajar tambah, kurang, kali, dan bagi dengan cara yang seru!"
            onClick={() => setActiveSubject('arithmetic')}
          />
          <SubjectCard 
            title="Aljabar"
            icon={Variable}
            color="orange"
            description="Pecahkan misteri angka yang hilang dengan logika kerenmu!"
            onClick={() => setActiveSubject('algebra')}
          />
          <SubjectCard 
            title="Bangun Ruang"
            icon={Triangle}
            color="green"
            description="Jelajahi dunia bentuk 3D yang ada di sekitarmu!"
            onClick={() => setActiveSubject('geometry')}
          />
        </section>

        {/* Learning Module Modal (Simplified) */}
        <AnimatePresence>
          {activeSubject && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            >
              <motion.div 
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 20 }}
                className="bg-white w-full max-w-4xl rounded-[40px] overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
              >
                <div className="p-6 border-b flex items-center justify-between">
                  <h2 className="text-2xl font-bold capitalize">{activeSubject} - Misi 1</h2>
                  <button onClick={() => setActiveSubject(null)} className="p-2 hover:bg-gray-100 rounded-full">
                    <X className="w-8 h-8" />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-12 text-center">
                  <div className="bg-blue-50 p-8 rounded-3xl mb-8">
                    <p className="text-3xl font-bold text-blue-600 mb-4">Berapakah 5 + 3?</p>
                    <div className="flex justify-center gap-4">
                      {[1, 2, 3, 4, 5].map(i => (
                        <div key={i} className="w-12 h-12 bg-red-400 rounded-full shadow-md" />
                      ))}
                      <span className="text-4xl font-bold text-gray-400">+</span>
                      {[1, 2, 3].map(i => (
                        <div key={i} className="w-12 h-12 bg-yellow-400 rounded-full shadow-md" />
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    {[6, 7, 8, 9].map(ans => (
                      <button 
                        key={ans}
                        onClick={async () => {
                          if (ans === 8) {
                            // Update progress
                            const totalScore = progress.reduce((acc, p) => acc + p.score, 0) + 10;
                            const subjectProgress = progress.filter(p => p.subject === activeSubject);
                            const subjectCount = subjectProgress.length + 1;

                            const progressRef = collection(db, 'progress');
                            await addDoc(progressRef, {
                              userId: user.uid,
                              subject: activeSubject,
                              level: 1,
                              score: 10,
                              lastUpdated: serverTimestamp()
                            });

                            // Check for rewards
                            let updatedBadges = [...(profile.badges || [])];
                            let updatedChars = [...(profile.unlockedCharacters || [])];
                            let reward = null;

                            // Badge: Math Hero
                            if (totalScore >= 100 && !updatedBadges.includes('math_hero')) {
                              updatedBadges.push('math_hero');
                              reward = { type: 'badge' as const, item: BADGES.find(b => b.id === 'math_hero') };
                            }

                            // Badge: Subject Master
                            const badgeId = `${activeSubject}_master` === 'geometry_master' ? 'geometry_explorer' : `${activeSubject}_master` === 'algebra_master' ? 'algebra_wizard' : 'arithmetic_master';
                            if (subjectCount >= 5 && !updatedBadges.includes(badgeId)) {
                              updatedBadges.push(badgeId);
                              reward = { type: 'badge' as const, item: BADGES.find(b => b.id === badgeId) };
                            }

                            // Character: Momo (after 30 points)
                            if (totalScore >= 30 && !updatedChars.includes('momo')) {
                              updatedChars.push('momo');
                              reward = { type: 'character' as const, item: CHARACTERS.find(c => c.id === 'momo') };
                            }

                            // Character: Lulu (after 70 points)
                            if (totalScore >= 70 && !updatedChars.includes('lulu')) {
                              updatedChars.push('lulu');
                              reward = { type: 'character' as const, item: CHARACTERS.find(c => c.id === 'lulu') };
                            }

                            if (reward) {
                              setNewReward(reward);
                              await setDoc(doc(db, 'users', user.uid), {
                                ...profile,
                                badges: updatedBadges,
                                unlockedCharacters: updatedChars
                              });
                            }

                            setActiveSubject(null);
                          } else {
                            alert("Coba lagi ya, kamu pasti bisa! 💪");
                          }
                        }}
                        className="p-6 text-2xl font-bold border-4 border-gray-100 rounded-3xl hover:border-blue-500 hover:bg-blue-50 transition-all"
                      >
                        {ans}
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Floating Chat Button */}
      <button 
        onClick={() => setShowChat(true)}
        className="fixed bottom-8 right-8 bg-blue-500 text-white p-5 rounded-full shadow-2xl hover:bg-blue-600 hover:scale-110 transition-all active:scale-95 z-40"
      >
        <MessageCircle className="w-8 h-8" />
      </button>

      {/* Chat Interface */}
      <AnimatePresence>
        {showChat && <ChatBot userId={user.uid} onClose={() => setShowChat(false)} />}
      </AnimatePresence>

      {/* Collection Interface */}
      <AnimatePresence>
        {showCollection && <CollectionView profile={profile} onClose={() => setShowCollection(false)} />}
      </AnimatePresence>

      {/* Reward Modal */}
      <AnimatePresence>
        {newReward && <RewardModal type={newReward.type} item={newReward.item} onClose={() => setNewReward(null)} />}
      </AnimatePresence>

      {/* Mobile Nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 p-4 flex justify-around md:hidden z-40">
        <button className="flex flex-col items-center gap-1 text-blue-600">
          <BookOpen className="w-6 h-6" />
          <span className="text-xs font-bold">Belajar</span>
        </button>
        <button onClick={() => setShowChat(true)} className="flex flex-col items-center gap-1 text-gray-400">
          <MessageCircle className="w-6 h-6" />
          <span className="text-xs font-bold">Tanya</span>
        </button>
        <button 
          onClick={() => setShowCollection(true)}
          className={cn("flex flex-col items-center gap-1", showCollection ? "text-blue-600" : "text-gray-400")}
        >
          <Trophy className="w-6 h-6" />
          <span className="text-xs font-bold">Koleksi</span>
        </button>
        <button className="flex flex-col items-center gap-1 text-gray-400">
          <Settings className="w-6 h-6" />
          <span className="text-xs font-bold">Menu</span>
        </button>
      </nav>
    </div>
  );
}
