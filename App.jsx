import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, collection, doc, getDocs, setDoc, addDoc, deleteDoc, updateDoc, onSnapshot, query 
} from 'firebase/firestore';
import { 
  getAuth, signInAnonymously, onAuthStateChanged 
} from 'firebase/auth';
import { 
  Users, Calendar, FileText, Bell, Search, Menu, User, CheckSquare, BookOpen, Settings, ChevronRight, GraduationCap, ClipboardList, Activity, Zap, ArrowLeft, CheckCircle, XCircle, Clock, Save, Calculator, MoreHorizontal, Home, MapPin, AlertTriangle, HeartHandshake, Phone, Image as ImageIcon, FileBarChart, MessageSquare, Plus, Trash2, Edit2, Map, Navigation, Book, PenTool, Download, Sparkles, Printer, FileQuestion, Layers, X, List, PieChart, FileSpreadsheet, DownloadCloud, TrendingUp, Award, Edit3, RefreshCw, UploadCloud, Wifi, WifiOff
} from 'lucide-react';

// ==================================================================================
// 🔴 ส่วนที่ 1: วาง Firebase Config ของอาจารย์ตรงนี้ครับ 🔴
// (ก๊อปปี้มาจาก Firebase Console แล้วนำมาวางทับตัวแปร firebaseConfig ด้านล่างนี้ทั้งหมด)
// ==================================================================================

// 👇 เริ่มวางทับตรงนี้ 👇
// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDxVLuX7_nMwRWyADTEr0NtD0pvZ3sjmt4",
  authDomain: "smart-teacher-v2.firebaseapp.com",
  projectId: "smart-teacher-v2",
  storageBucket: "smart-teacher-v2.firebasestorage.app",
  messagingSenderId: "430750008319",
  appId: "1:430750008319:web:9c0079e057a433edd19dca"
};
// 👆 สิ้นสุดการวาง 👆

// ==================================================================================

// Initialize Firebase
let db, auth;
let appId = 'smart-teacher-default'; // ใช้แยกข้อมูลกรณีทดสอบหลายคน (ปล่อยไว้ได้ครับ)

try {
  // ตรวจสอบว่ามีการใส่ Config หรือยัง
  if (firebaseConfig && firebaseConfig.apiKey) {
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);
    console.log("Firebase initialized successfully!");
  } else {
    // กรณีรันในสภาพแวดล้อมทดสอบของ Gemini (Canvas)
    if (typeof __firebase_config !== 'undefined') {
        const app = initializeApp(JSON.parse(__firebase_config));
        db = getFirestore(app);
        auth = getAuth(app);
        appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
    } else {
        console.warn("⚠️ ยังไม่ได้ใส่ Firebase Config: ระบบจะทำงานแบบ Offline (ข้อมูลไม่บันทึกออนไลน์)");
    }
  }
} catch (e) {
  console.error("Firebase config error:", e);
}

const App = () => {
  const [user, setUser] = useState(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  
  // --- AUTHENTICATION (เข้าระบบแบบไม่ระบุตัวตน เพื่อความง่าย) ---
  useEffect(() => {
    if (!auth) return;
    
    const initAuth = async () => {
       try {
         // พยายามล็อกอิน ถ้ามี Token พิเศษ (สำหรับ Canvas) ให้ใช้
         if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
             // ข้ามขั้นตอนนี้ใน Canvas
         } else {
            await signInAnonymously(auth);
         }
       } catch (error) {
         console.error("Auth Error:", error);
       }
    };
    initAuth();

    const unsubscribe = onAuthStateChanged(auth, (u) => {
        if (u) {
            console.log("User logged in:", u.uid);
            setUser(u);
        } else {
            console.log("User logged out");
            setUser(null);
        }
    });
    return () => unsubscribe();
  }, []);

  // --- DATA SYNCING (REAL-TIME) ---
  const [students, setStudents] = useState([]);
  const [lessonPlans, setLessonPlans] = useState([]);
  const [assessments, setAssessments] = useState([]);
  const [scores, setScores] = useState({}); 
  const [loading, setLoading] = useState(true);

  // Default Data (ข้อมูลเริ่มต้น หากฐานข้อมูลว่างเปล่า)
  const defaultStudents = [
    { id: 1, name: "ด.ช. กิตติศักดิ์ รักเรียน", number: 1, status: 'present', risk: 'normal', gpa: 3.50, visits: [], sdq: { emotional: 'normal' } },
    { id: 2, name: "ด.ญ. ณัฐธิดา ใจดี", number: 2, status: 'present', risk: 'normal', gpa: 3.85, visits: [], sdq: { emotional: 'normal' } },
    { id: 3, name: "ด.ช. ธีรภัทร กล้าหาญ", number: 3, status: 'absent', risk: 'risk', gpa: 2.45, visits: [], sdq: { emotional: 'risk' } },
    { id: 4, name: "ด.ญ. พิมพ์ชนก สดใส", number: 4, status: 'present', risk: 'normal', gpa: 3.20, visits: [], sdq: { emotional: 'normal' } },
    { id: 5, name: "ด.ช. วรพล คนเก่ง", number: 5, status: 'late', risk: 'alarm', gpa: 1.90, visits: [], sdq: { emotional: 'problem' } }
  ];

  // Fetch Data Listener
  useEffect(() => {
    // ถ้าไม่มี DB ให้ใช้ข้อมูล Local (Offline Mode)
    if (!db) {
        setStudents(defaultStudents);
        setLoading(false);
        return;
    }
    // รอจนกว่าจะ Login สำเร็จ
    if (!user) return;

    // ใช้ Path กลางเพื่อให้เห็นข้อมูลเดียวกัน (Public Data) 
    // ในการใช้งานจริงอาจเปลี่ยนเป็น users/${user.uid}/data เพื่อแยกข้อมูลครูแต่ละคน
    const basePath = `artifacts/${appId}/public/data`;
    
    // 1. ดึงข้อมูลนักเรียน
    const unsubStudents = onSnapshot(collection(db, basePath, 'students'), (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        if (data.length === 0) {
            // ถ้าว่างเปล่า (เพิ่งสร้าง DB ใหม่) ให้ใส่ข้อมูลเริ่มต้นลงไป
             defaultStudents.forEach(async (s) => {
                 await setDoc(doc(db, basePath, 'students', s.id.toString()), s);
             });
        } else {
             setStudents(data.sort((a,b) => a.number - b.number));
        }
        setLoading(false);
    }, (error) => console.error("Sync Error Students:", error));

    // 2. ดึงแผนการสอน
    const unsubPlans = onSnapshot(collection(db, basePath, 'lessonPlans'), (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setLessonPlans(data.sort((a,b) => a.week - b.week));
    }, (error) => console.error("Sync Error Plans:", error));

     // 3. ดึงงานที่มอบหมาย
     const unsubAssessments = onSnapshot(collection(db, basePath, 'assessments'), (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setAssessments(data);
    }, (error) => console.error("Sync Error Assessments:", error));

    return () => {
        unsubStudents();
        unsubPlans();
        unsubAssessments();
    };
  }, [user]); // ทำงานเมื่อ user เปลี่ยนสถานะ

  // --- CRUD OPERATIONS (FIRESTORE HELPERS) ---
  const getBasePath = () => `artifacts/${appId}/public/data`;

  const firestoreUpdateStudent = async (student) => {
      if(!db || !user) return;
      await setDoc(doc(db, getBasePath(), 'students', student.id.toString()), student);
  };

  const firestoreDeleteStudent = async (id) => {
      if(!db || !user) return;
      await deleteDoc(doc(db, getBasePath(), 'students', id.toString()));
  };

  const firestoreUpdatePlan = async (plan) => {
      if(!db || !user) return;
      await setDoc(doc(db, getBasePath(), 'lessonPlans', plan.id.toString()), plan);
  };

  // --- VIEW LOGIC ---
  const [activeTab, setActiveTab] = useState('home');
  const [currentView, setCurrentView] = useState('dashboard');
  const [selectedStudent, setSelectedStudent] = useState(null);
  
  // States specific to views
  const [selectedAssessment, setSelectedAssessment] = useState(null);
  const [isEditingSchedule, setIsEditingSchedule] = useState(false);
  const [selectedDay, setSelectedDay] = useState('จันทร์');
  const [expandedLessonId, setExpandedLessonId] = useState(null);
  const [showCreatePlan, setShowCreatePlan] = useState(false);
  const [newPlanInput, setNewPlanInput] = useState({ subject: '', grade: '', hours: '' });
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
  const [isGeneratingPost, setIsGeneratingPost] = useState(false);
  const [editingRecord, setEditingRecord] = useState({ id: null, result: '', problems: '', suggestions: '' });
  const [showPrintPreview, setShowPrintPreview] = useState(null);

  // Initialize selection when data loads
  useEffect(() => {
      if (assessments.length > 0 && !selectedAssessment) {
          setSelectedAssessment(assessments[0]);
      }
  }, [assessments]);

  // Teacher Profile
  const teacherProfile = {
    name: "นายเอกอาวุธ สุริยะเจริญ",
    position: "โรงเรียนเทศบาล ๑ บ้านกลาง",
    school: "โรงเรียนเทศบาล ๑ บ้านกลาง",
    avatarColor: "bg-amber-500"
  };

  // Schedule Logic (Simplified static for now)
  const scheduleToday = [
    { time: "08:30 - 09:20", subject: "คณิตศาสตร์ ม.1/1", room: "Smart Lab 1" },
    { time: "10:10 - 11:00", subject: "วิทยาการคำนวณ", room: "Computer Room 3" },
    { time: "13:00 - 13:50", subject: "คณิตศาสตร์ ม.2/3", room: "อาคาร 2 ห้อง 204" },
  ];

  // --- HANDLERS (Connected to Firestore) ---

  const handleAddStudent = async () => {
    const newId = students.length > 0 ? Math.max(...students.map(s => parseInt(s.id))) + 1 : 1;
    const newStudent = {
        id: newId, name: "นักเรียนใหม่", number: students.length + 1, status: 'present', risk: 'normal', gpa: 0.00, visits: [], sdq: { emotional: 'normal' }
    };
    if (db) await firestoreUpdateStudent(newStudent);
    else setStudents([...students, newStudent]); // Fallback Local
  };

  const handleRemoveStudent = async (id) => {
      if(window.confirm("ยืนยันลบรายชื่อนักเรียน?")) {
          if (db) await firestoreDeleteStudent(id);
          else setStudents(students.filter(s => s.id !== id));
      }
  }

  const toggleStatus = async (student) => {
      const nextStatus = student.status === 'present' ? 'absent' : student.status === 'absent' ? 'late' : 'present';
      const updated = { ...student, status: nextStatus };
      if (db) await firestoreUpdateStudent(updated);
      else setStudents(students.map(s => s.id === student.id ? updated : s));
  };

  // Helper for Plan
  const handleSavePostRecord = async () => {
     // Find the plan we are editing
     const planToUpdate = lessonPlans.find(p => p.id === editingRecord.id);
     if (planToUpdate) {
         const updatedPlan = {
             ...planToUpdate,
             status: 'recorded',
             postRecord: {
                 result: editingRecord.result,
                 problems: editingRecord.problems,
                 suggestions: editingRecord.suggestions
             }
         };
         if (db) await firestoreUpdatePlan(updatedPlan);
         else setLessonPlans(lessonPlans.map(p => p.id === updatedPlan.id ? updatedPlan : p));
         setExpandedLessonId(null);
     }
  };
  
  // Expand Lesson Logic
  const handleExpandLesson = (plan) => {
    if (expandedLessonId === plan.id) {
        setExpandedLessonId(null);
    } else {
        setExpandedLessonId(plan.id);
        // Load current record into editing state
        setEditingRecord({
            id: plan.id,
            result: plan.postRecord?.result || '',
            problems: plan.postRecord?.problems || '',
            suggestions: plan.postRecord?.suggestions || ''
        });
    }
  };

  const getRiskBadge = (risk) => {
    switch(risk) {
      case 'normal': return { text: 'ปกติ', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' };
      case 'risk': return { text: 'กลุ่มเสี่ยง', color: 'text-orange-400 bg-orange-500/10 border-orange-500/30' };
      case 'alarm': return { text: 'มีปัญหา', color: 'text-red-400 bg-red-500/10 border-red-500/30' };
      default: return { text: '-', color: 'text-slate-400' };
    }
  };

  // --- RENDERERS ---

  const renderDashboard = () => (
    <div className="fade-in space-y-6">
        {/* Status Bar */}
        <div className={`flex justify-between items-center p-2 rounded-lg border text-[10px] ${db ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
             <div className="flex items-center space-x-2">
                {db ? <Wifi size={14}/> : <WifiOff size={14}/>}
                <span>{db ? 'Online: บันทึกข้อมูลอัตโนมัติ' : 'Offline Mode: ข้อมูลไม่ถูกบันทึก'}</span>
             </div>
             {loading && <span className="animate-pulse">Syncing...</span>}
        </div>

        <div className="relative group overflow-hidden rounded-2xl p-0.5 bg-gradient-to-br from-amber-500 via-orange-500 to-purple-600 shadow-lg shadow-amber-900/20">
            <div className="bg-slate-950 rounded-[14px] p-5 relative overflow-hidden">
                <div className="flex justify-between items-start mb-2">
                    <div><h2 className="text-lg font-bold text-white">DASHBOARD</h2><p className="text-slate-400 text-sm">ภาพรวมวันนี้</p></div>
                    <div className="bg-slate-900 p-1.5 rounded-lg border border-amber-500/50"><Activity size={18} className="text-amber-400" /></div>
                </div>
                <div className="mt-4 flex space-x-3">
                    <button onClick={() => setCurrentView('attendance')} className="flex-1 bg-gradient-to-r from-amber-600 to-orange-600 text-white py-2.5 rounded-lg text-xs font-bold flex justify-center items-center shadow-lg hover:scale-105 transition"><Zap size={14} className="mr-1.5 fill-current"/> เช็คชื่อด่วน</button>
                    <button onClick={() => setCurrentView('registrar')} className="flex-1 bg-slate-900 border border-slate-800 text-slate-300 py-2.5 rounded-lg text-xs font-medium flex justify-center items-center hover:bg-slate-800 transition"><ClipboardList size={14} className="mr-1.5"/> รายงาน</button>
                </div>
            </div>
        </div>

        <div>
            <h3 className="text-slate-200 font-bold text-sm mb-4 tracking-wide">MAIN MENU</h3>
            <div className="grid grid-cols-3 gap-3">
                {[
                    { id: 'attendance', title: 'เช็คชื่อ', icon: CheckSquare, color: 'text-amber-400' },
                    { id: 'grades', title: 'บันทึกคะแนน', icon: FileText, color: 'text-blue-400' },
                    { id: 'student_support', title: 'ระบบดูแลฯ', icon: Users, color: 'text-purple-400' },
                    { id: 'schedule', title: 'ตารางสอน', icon: Calendar, color: 'text-orange-400' },
                    { id: 'lesson_plans', title: 'แผนการสอน', icon: BookOpen, color: 'text-pink-400' },
                    { id: 'registrar', title: 'งานทะเบียน', icon: GraduationCap, color: 'text-emerald-400' }
                ].map((m) => (
                    <button key={m.id} onClick={() => setCurrentView(m.id)} className="bg-slate-900/50 border border-slate-800 p-3 rounded-xl backdrop-blur-sm flex flex-col items-center justify-center hover:bg-slate-800 transition active:scale-95">
                        <div className="w-10 h-10 rounded-full bg-slate-900 flex items-center justify-center mb-2 shadow-inner"><m.icon className={`${m.color} w-6 h-6`} /></div>
                        <span className="text-[10px] text-slate-300 font-medium">{m.title}</span>
                    </button>
                ))}
            </div>
        </div>

        <div>
            <h3 className="text-slate-200 font-bold text-sm mb-4">TIMELINE (วันนี้)</h3>
            <div className="space-y-3 relative">
                <div className="absolute left-[19px] top-4 bottom-4 w-0.5 bg-slate-800 -z-10"></div>
                {scheduleToday.map((slot, index) => (
                    <div key={index} className="flex items-start">
                        <div className="w-10 flex flex-col items-center mr-3 pt-1"><div className="w-3 h-3 rounded-full border-2 bg-amber-500 border-amber-300 shadow"></div></div>
                        <div className="flex-1 bg-slate-900/50 border border-slate-800/50 p-3 rounded-xl hover:border-amber-500/30 transition">
                            <p className="text-xs text-amber-400 font-mono mb-1">{slot.time}</p>
                            <h4 className="text-sm font-bold text-slate-200">{slot.subject}</h4>
                            <p className="text-xs text-slate-500 mt-1 flex items-center"><MapPin size={12} className="mr-1"/> {slot.room}</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    </div>
  );

  const renderAttendance = () => (
    <div className="fade-in">
        <div className="flex items-center space-x-4 mb-6">
            <button onClick={() => setCurrentView('dashboard')} className="p-2 bg-slate-800 rounded-full text-slate-300"><ArrowLeft size={20} /></button>
            <div className="flex-1"><h2 className="text-lg font-bold text-white">เช็คชื่อ</h2><p className="text-xs text-amber-400">คณิตศาสตร์ ม.1/1</p></div>
            <button onClick={handleAddStudent} className="bg-emerald-600 text-white px-3 py-2 rounded-xl text-xs font-bold flex items-center space-x-1"><Plus size={16}/><span>เพิ่ม นร.</span></button>
        </div>
        <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="bg-emerald-900/20 border border-emerald-500/30 p-3 rounded-xl text-center"><p className="text-xs text-emerald-400">มาเรียน</p><span className="text-xl font-bold text-emerald-300">{students.filter(s => s.status === 'present').length}</span></div>
            <div className="bg-red-900/20 border border-red-500/30 p-3 rounded-xl text-center"><p className="text-xs text-red-400">ขาดเรียน</p><span className="text-xl font-bold text-red-300">{students.filter(s => s.status === 'absent').length}</span></div>
            <div className="bg-amber-900/20 border border-amber-500/30 p-3 rounded-xl text-center"><p className="text-xs text-amber-400">สาย</p><span className="text-xl font-bold text-amber-300">{students.filter(s => s.status === 'late').length}</span></div>
        </div>
        <div className="bg-slate-900/40 border border-slate-800 rounded-2xl overflow-hidden mb-24">
            <div className="p-4 border-b border-slate-800"><h3 class="text-sm font-bold text-slate-200">รายชื่อ ({students.length})</h3></div>
            <div className="divide-y divide-slate-800/50">
                {students.map(s => (
                    <div key={s.id} className="p-4 flex items-center justify-between hover:bg-slate-800/30 transition">
                        <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-400 border border-slate-700">{s.number}</div>
                            <div><h4 className="text-sm font-medium text-slate-200">{s.name}</h4></div>
                        </div>
                        <div className="flex items-center space-x-2">
                             <button onClick={() => toggleStatus(s)} className={`px-3 py-1.5 rounded-lg border text-xs font-bold w-16 text-center transition ${
                                s.status === 'present' ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10' :
                                s.status === 'absent' ? 'text-red-400 border-red-500/30 bg-red-500/10' :
                                'text-amber-400 border-amber-500/30 bg-amber-500/10'
                            }`}>{s.status}</button>
                             <button onClick={() => handleRemoveStudent(s.id)} className="p-1.5 text-slate-600 hover:text-red-400"><Trash2 size={16}/></button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    </div>
  );

  const renderLessonPlans = () => (
    <div className="fade-in">
        <div className="flex items-center space-x-4 mb-6">
            <button onClick={() => setCurrentView('dashboard')} className="p-2 bg-slate-800 rounded-full text-slate-300"><ArrowLeft size={20} /></button>
            <div className="flex-1"><h2 className="text-lg font-bold text-white">แผนการสอน</h2><p className="text-xs text-pink-400">แบบ Online</p></div>
        </div>
        <div className="space-y-4 mb-24">
            {lessonPlans.map((plan, index) => {
                 const isExpanded = expandedLessonId === plan.id;
                 return (
                <div key={plan.id} className={`bg-slate-900/60 border ${isExpanded ? 'border-pink-500/50 shadow-lg shadow-pink-900/20' : 'border-slate-800'} rounded-2xl overflow-hidden transition-all duration-300`}>
                    <div onClick={() => handleExpandLesson(plan)} className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-800/50 transition">
                        <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm bg-emerald-500 text-slate-900">W{plan.week}</div>
                            <div>
                                <h4 className="text-sm font-bold text-slate-200 line-clamp-1">{plan.topic}</h4>
                                <div className="flex items-center space-x-2 mt-1"><span className="text-[10px] text-slate-500 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800">{plan.hours} ชั่วโมง</span></div>
                            </div>
                        </div>
                        <ChevronRight className="text-slate-500 w-5 h-5"/>
                    </div>
                    {isExpanded && (
                        <div className="bg-slate-950/50 border-t border-slate-800 p-4">
                            <div className="space-y-4 mb-4">
                                <div><h5 className="text-xs text-pink-400 font-bold mb-1">จุดประสงค์</h5><p className="text-xs text-slate-300 bg-slate-900 p-2 rounded whitespace-pre-line">{plan.objectives}</p></div>
                            </div>
                            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
                                <div className="flex items-center justify-between mb-2">
                                    <h5 className="text-xs font-bold text-white">บันทึกหลังสอน (Firebase)</h5>
                                </div>
                                <textarea 
                                    rows="3" 
                                    value={editingRecord.result}
                                    onChange={(e) => setEditingRecord({...editingRecord, result: e.target.value})}
                                    className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500 mb-2"
                                    placeholder="พิมพ์บันทึก..."
                                ></textarea>
                                <button onClick={handleSavePostRecord} className="w-full bg-pink-600 text-white py-2 rounded-lg text-xs font-bold hover:bg-pink-500 transition"><Save size={14} className="inline mr-1"/>บันทึกผล</button>
                            </div>
                        </div>
                    )}
                </div>
            )})}
        </div>
    </div>
  );

  const renderRegistrar = () => (
      <div className="fade-in">
        <div className="flex items-center space-x-4 mb-6">
            <button onClick={() => setCurrentView('dashboard')} className="p-2 bg-slate-800 rounded-full text-slate-300"><ArrowLeft size={20} /></button>
            <div><h2 className="text-lg font-bold text-white">งานทะเบียน</h2><p className="text-xs text-emerald-400">ระบบออนไลน์</p></div>
        </div>
        <div className="bg-slate-900/60 border border-emerald-500/30 p-4 rounded-2xl mb-6">
            <div className="text-2xl font-bold text-white text-center">{students.length} <span className="text-xs text-slate-500 font-normal">นักเรียนทั้งหมด</span></div>
        </div>
        <div className="bg-slate-900/40 border border-slate-800 rounded-2xl overflow-hidden">
            <div className="p-4 border-b border-slate-800"><h3 class="text-sm font-bold text-slate-200">รายชื่อ (ซิงค์อัตโนมัติ)</h3></div>
            <div className="divide-y divide-slate-800/50">
                {students.map(s => (
                    <div key={s.id} className="p-4 flex justify-between items-center">
                        <span className="text-slate-200 text-sm">{s.number}. {s.name}</span>
                        <span className="text-slate-500 text-xs">GPA: {s.gpa.toFixed(2)}</span>
                    </div>
                ))}
            </div>
        </div>
      </div>
  );

  const renderPlaceholder = (title) => (
      <div className="text-center py-20 text-slate-500">
          <p>หน้า {title}</p>
          <p className="text-xs mt-2 text-slate-600">กำลังเชื่อมต่อฐานข้อมูล...</p>
          <button onClick={() => setCurrentView('dashboard')} className="mt-4 text-amber-400 underline">กลับหน้าหลัก</button>
      </div>
  );

  // --- MAIN RENDER ---
  return (
    <div className="min-h-screen bg-slate-950 font-sans pb-24 text-slate-100 selection:bg-amber-500 selection:text-white">
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] right-[-10%] w-64 h-64 bg-amber-600/20 rounded-full blur-3xl"></div>
        <div className="absolute bottom-[10%] left-[-10%] w-80 h-80 bg-amber-600/10 rounded-full blur-3xl"></div>
      </div>

      <header className="bg-slate-950/80 backdrop-blur-md border-b border-slate-800/50 sticky top-0 z-20">
        <div className="max-w-md mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-amber-500 rounded-full flex items-center justify-center text-slate-900 font-bold border-2 border-amber-500/50"><User size={20} /></div>
            <div><h1 className="text-sm font-bold text-white tracking-wide">{teacherProfile.name}</h1><p className="text-[10px] text-amber-400 uppercase tracking-wider font-semibold">{teacherProfile.position}</p></div>
          </div>
          <button className="p-2 text-slate-400 bg-slate-800/50 rounded-full"><Bell size={20} /></button>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 pt-6 relative z-10">
        {currentView === 'dashboard' && renderDashboard()}
        {currentView === 'attendance' && renderAttendance()}
        {currentView === 'lesson_plans' && renderLessonPlans()}
        {currentView === 'registrar' && renderRegistrar()}
        {/* Render placeholders for other views to keep file concise */}
        {['grades', 'student_support', 'schedule', 'settings'].includes(currentView) && renderPlaceholder(currentView)}
      </main>

      <nav className="fixed bottom-4 left-4 right-4 z-30">
        <div className="max-w-md mx-auto bg-slate-900/90 backdrop-blur-xl border border-amber-500/20 rounded-2xl shadow-2xl shadow-amber-900/10 px-6 py-3 flex justify-between items-center">
          <button onClick={() => setCurrentView('dashboard')} className={`flex flex-col items-center space-y-1 transition ${currentView === 'dashboard' ? 'text-amber-400' : 'text-slate-500'}`}><Users size={20} /><span className="text-[9px] font-medium">HOME</span></button>
          <button onClick={() => setCurrentView('schedule')} className={`flex flex-col items-center space-y-1 transition ${currentView === 'schedule' ? 'text-amber-400' : 'text-slate-500'}`}><Calendar size={20} /><span className="text-[9px] font-medium">PLAN</span></button>
          <div className="relative -top-8"><button className="w-14 h-14 bg-gradient-to-tr from-amber-500 to-orange-600 rounded-full shadow-lg flex items-center justify-center text-white border-4 border-slate-950 hover:scale-105 transition"><Search size={24} /></button></div>
          <button onClick={() => setCurrentView('registrar')} className={`flex flex-col items-center space-y-1 transition ${currentView === 'registrar' ? 'text-amber-400' : 'text-slate-500'}`}><FileText size={20} /><span className="text-[9px] font-medium">DOCS</span></button>
          <button onClick={() => setCurrentView('settings')} className={`flex flex-col items-center space-y-1 transition ${currentView === 'settings' ? 'text-amber-400' : 'text-slate-500'}`}><Settings size={20} /><span className="text-[9px] font-medium">SET</span></button>
        </div>
      </nav>
    </div>
  );
};

export default App;
