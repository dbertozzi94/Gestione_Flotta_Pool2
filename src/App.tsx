import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Car,
  User,
  AlertTriangle,
  Plus,
  ArrowRight,
  CheckCircle,
  Trash2,
  Loader2,
  Camera,
  PenTool,
  FileText,
  X,
  Zap,
  ShieldAlert,
  Search,
  FileDown,
  Pencil,
  Lock,
  LogIn,
  Users,
  AlertCircle,
  Download,
} from "lucide-react";
import { jsPDF } from "jspdf";

// --- IMPORT FIREBASE ---
import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously, onAuthStateChanged } from "firebase/auth";
import {
  getFirestore,
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  runTransaction,
  setDoc,
} from "firebase/firestore";

// Definizioni per TypeScript (Mantenute per coerenza)
declare global {
  interface Window {
    emailjs: any;
    jspdf: any;
    // Aggiunto per il check mobile
    opera?: any;
  }
}

// --- VARIABILI GLOBALI (CANVAS) ---
// Queste variabili sono fornite dall'ambiente Canvas.
const __app_id = "flotta-renco-v1"; // Usato come fallback
const __firebase_config = `{
  "apiKey": "AIzaSyCZTaNfYTeqKaWKOnf-dqQsBFwL4pZHQfM",
  "authDomain": "gestione-flotta-pool.firebaseapp.com",
  "projectId": "gestione-flotta-pool",
  "storageBucket": "gestione-flotta-pool.firebasestorage.app",
  "messagingSenderId": "86851688702",
  "appId": "1:86851688702:web:1cff896b5909a26ada2daf"
}`;

// --- SICUREZZA ---
const PIN_UNICO = "RencoAdmin2025!"; // PIN Unico per l'accesso (Admin)

// INTERFACCIA TOAST
interface ToastState {
  visible: boolean;
  message: string;
  type?: "success" | "error" | string;
}

// --- CONFIGURAZIONE FIREBASE ---
const firebaseConfig = JSON.parse(__firebase_config);
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== "undefined" ? __app_id : "default-app-id";

// Funzione per ottenere il percorso della collezione pubblica
const getPublicCollectionPath = (collectionName: string) =>
  collection(db, "artifacts", appId, "public", "data", collectionName);

// Funzione per ottenere il riferimento al documento pubblico
const getPublicDocRef = (collectionName: string, docId: string) =>
  doc(db, "artifacts", appId, "public", "data", collectionName, docId);

// --- CONFIGURAZIONE EMAIL (EMAILJS) ---
const EMAILJS_CONFIG = {
  SERVICE_ID: "", // ID del Servizio EmailJS
  TEMPLATE_ID: "", // ID del Template EmailJS
  PUBLIC_KEY: "", // Chiave pubblica EmailJS
};

// --- CARICAMENTO SCRIPT ESTERNI ---
const loadExternalScripts = () => {
  if (!window.emailjs && EMAILJS_CONFIG.PUBLIC_KEY) {
    const script = document.createElement("script");
    script.src =
      "https://cdn.jsdelivr.net/npm/@emailjs/browser@3/dist/email.min.js";
    script.onload = () => window.emailjs.init(EMAILJS_CONFIG.PUBLIC_KEY);
    document.head.appendChild(script);
  }

  if (!window.jspdf) {
    const script = document.createElement("script");
    script.src =
      "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
    document.head.appendChild(script);
  }
};

// --- FUNZIONE CONTATORE PROGRESSIVO (TRIP ID) ---
const getNextTripId = async (dbInstance: any) => {
  const counterRef = getPublicDocRef("counters", "trips");
  try {
    const newId = await runTransaction(dbInstance, async (transaction: any) => {
      const counterDoc = await transaction.get(counterRef);
      let currentCount = 0;
      if (counterDoc.exists()) {
        currentCount = counterDoc.data().count || 0;
      }
      const nextCount = currentCount + 1;
      // Uso setDoc invece di update/set (come fallback se non esiste)
      transaction.set(counterRef, { count: nextCount }, { merge: true });
      return nextCount;
    });
    return newId.toString().padStart(5, "0");
  } catch (e) {
    console.error("Errore generazione ID:", e);
    return "ERR-" + Date.now().toString().slice(-4);
  }
};

// --- COMPONENTI UTILITY ---

const Card = ({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) => (
  <div
    className={`bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden ${className}`}
  >
    {children}
  </div>
);

const Button = ({
  children,
  onClick,
  variant = "primary",
  className = "",
  disabled = false,
  loading = false,
  type = "button",
}: any) => {
  const variants: any = {
    primary: "bg-orange-600 text-white hover:bg-orange-700 shadow-orange-100",
    secondary:
      "bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200",
    danger: "bg-red-50 text-red-600 hover:bg-red-100",
    success: "bg-green-600 text-white hover:bg-green-700",
    outline: "border border-gray-300 text-gray-700 hover:bg-gray-50",
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`px-4 py-3 rounded-lg font-medium transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed shadow-sm w-full ${variants[variant]} ${className}`}
    >
      {loading && <Loader2 className="w-4 h-4 animate-spin" />}
      {children}
    </button>
  );
};

const Badge = ({ status }: { status: string }) => {
  const styles: any = {
    disponibile: "bg-green-100 text-green-700 border-green-200",
    impegnato: "bg-orange-100 text-orange-700 border-orange-200",
    manutenzione: "bg-red-100 text-red-700 border-red-200",
  };
  return (
    <span
      className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
        styles[status.toLowerCase()] || "bg-gray-100"
      }`}
    >
      {status}
    </span>
  );
};

// Nuovo componente per sostituire alert/confirm
const ConfirmationModal = ({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
  confirmText = "Conferma",
  cancelText = "Annulla",
}: any) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto bg-black/70 backdrop-blur-sm">
      <div className="flex min-h-full items-center justify-center p-4 text-center">
        <div className="w-full max-w-sm transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-2xl transition-all">
          <div className="flex items-start gap-4 mb-4">
            <AlertCircle className="w-6 h-6 text-red-500 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-lg font-bold text-gray-900">{title}</h3>
              <p className="text-sm text-gray-500 mt-1">{message}</p>
            </div>
          </div>

          <div className="mt-4 flex gap-3">
            <Button variant="secondary" onClick={onCancel}>
              {cancelText}
            </Button>
            <Button variant="danger" onClick={onConfirm}>
              {confirmText}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Componente per l'upload di una singola foto veicolo (PUNTO 3)
const VehiclePhotoUpload = ({ imageUrl, setImageUrl, onShowToast }: any) => {
  const [compressing, setCompressing] = useState(false);

  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const MAX_WIDTH = 400; // Compressione più aggressiva per l'immagine del veicolo
          const MAX_HEIGHT = 400;
          let width = img.width;
          let height = img.height;
          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          ctx?.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL("image/jpeg", 0.7)); // Qualità 70%
        };
        img.onerror = (err) => reject(err);
      };
      reader.onerror = (err) => reject(err);
    });
  };

  const handleFile = async (e: any) => {
    const file = e.target.files[0];
    if (file) {
      setCompressing(true);
      try {
        const compressedBase64 = await compressImage(file);
        setImageUrl(compressedBase64);
        onShowToast("Immagine caricata e compressa.", "success");
      } catch (error) {
        console.error("Errore compressione immagine", error);
        onShowToast("Impossibile caricare l'immagine.", "error");
      } finally {
        setCompressing(false);
        e.target.value = null; // Resetta input file
      }
    }
  };

  const removePhoto = () => {
    setImageUrl(null);
  };

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Foto Principale Veicolo
      </label>
      <div className="flex items-center gap-4">
        {imageUrl ? (
          <div className="relative w-24 h-24 rounded-lg overflow-hidden border border-gray-200 group shrink-0">
            <img
              src={imageUrl}
              alt="Anteprima veicolo"
              className="w-full h-full object-cover"
            />
            <button
              type="button"
              onClick={removePhoto}
              className="absolute top-0 right-0 bg-red-600 text-white p-1 rounded-bl opacity-100 group-hover:opacity-100 transition-opacity"
              title="Rimuovi foto"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <label
            className={`w-24 h-24 flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 text-gray-500 hover:text-orange-600 hover:border-orange-300 transition-colors shrink-0 ${
              compressing ? "opacity-50 cursor-wait" : ""
            }`}
          >
            {compressing ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : (
              <Camera className="w-8 h-8 mb-1" />
            )}
            <span className="text-xs">
              {compressing ? "..." : "Carica Foto"}
            </span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFile}
              disabled={compressing}
              capture="environment" // Ottimizza per la fotocamera posteriore su mobile
            />
          </label>
        )}
      </div>
      <p className="text-[10px] text-gray-400 mt-2">
        Sarà usata come icona nella Dashboard. Viene compressa automaticamente.
      </p>
    </div>
  );
};

const SignaturePad = ({ onSave, label, disclaimer, initialSignature }: any) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);

  // Funzione di inizializzazione per disegnare la firma iniziale (se esiste)
  const drawInitialSignature = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Reset del canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";

    if (initialSignature) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        setHasSignature(true);
      };
      img.src = initialSignature;
    }
  }, [initialSignature]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.width = canvas.offsetWidth;
      canvas.height = 150;
      drawInitialSignature(); // Disegna al mount
    }
  }, [drawInitialSignature]);

  const startDrawing = (e: any) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX || e.touches[0].clientX) - rect.left;
    const y = (e.clientY || e.touches[0].clientY) - rect.top;

    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
    setHasSignature(true); // Indica che l'utente ha iniziato a disegnare
  };

  const draw = (e: any) => {
    if (!isDrawing) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX || e.touches[0].clientX) - rect.left;
    const y = (e.clientY || e.touches[0].clientY) - rect.top;

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (isDrawing) {
      setIsDrawing(false);
      const canvas = canvasRef.current;
      if (canvas) onSave(canvas.toDataURL());
    }
  };

  const clear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
    onSave(null);
  };

  return (
    <div className="border rounded-lg p-4 bg-gray-50">
      {disclaimer && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800 font-medium leading-relaxed text-justify">
          {disclaimer}
        </div>
      )}
      <div className="flex justify-between items-center mb-2">
        <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
          <PenTool className="w-4 h-4" /> {label}
        </label>
        <button
          type="button"
          onClick={clear}
          className="text-xs text-red-600 hover:underline disabled:opacity-50"
          disabled={!hasSignature}
        >
          Pulisci
        </button>
      </div>
      <canvas
        ref={canvasRef}
        className="w-full bg-white border border-gray-300 rounded cursor-crosshair touch-none shadow-sm"
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseLeave={stopDrawing}
        onTouchStart={startDrawing}
        onTouchMove={draw}
        onTouchEnd={stopDrawing}
      />
      {!hasSignature && (
        <p className="text-xs text-gray-400 mt-1 text-center">
          Firma nell'area bianca
        </p>
      )}
    </div>
  );
};

const PhotoUpload = ({ photos, setPhotos, onShowToast }: any) => {
  const [compressing, setCompressing] = useState(false);

  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const MAX_WIDTH = 800;
          const MAX_HEIGHT = 800;
          let width = img.width;
          let height = img.height;
          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          ctx?.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL("image/jpeg", 0.6));
        };
        img.onerror = (err) => reject(err);
      };
      reader.onerror = (err) => reject(err);
    });
  };

  const handleFile = async (e: any) => {
    const file = e.target.files[0];
    if (file) {
      setCompressing(true);
      try {
        const compressedBase64 = await compressImage(file);
        setPhotos([...photos, compressedBase64]);
      } catch (error) {
        console.error("Errore compressione immagine", error);
        onShowToast("Impossibile caricare l'immagine.", "error");
      } finally {
        setCompressing(false);
        e.target.value = null; // Resetta input file
      }
    }
  };

  const removePhoto = (index: number) => {
    setPhotos(photos.filter((_: any, i: number) => i !== index));
  };

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Foto (Danni o Segnalazioni)
      </label>
      <div className="flex flex-wrap gap-2 mb-2">
        {photos.map((photo: string, idx: number) => (
          <div
            key={idx}
            className="relative w-20 h-20 rounded-lg overflow-hidden border border-gray-200 group"
          >
            <img
              src={photo}
              alt="preview"
              className="w-full h-full object-cover"
              // Fallback image in case of error
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.onerror = null;
                target.src = "https://placehold.co/80x80/ef4444/ffffff?text=X";
                target.style.objectFit = "contain";
              }}
            />
            <button
              type="button"
              onClick={() => removePhoto(idx)}
              className="absolute top-0 right-0 bg-red-600 text-white p-0.5 rounded-bl opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}
        <label
          className={`w-20 h-20 flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 text-gray-500 hover:text-orange-600 hover:border-orange-300 transition-colors ${
            compressing ? "opacity-50 cursor-wait" : ""
          }`}
        >
          {compressing ? (
            <Loader2 className="w-6 h-6 animate-spin" />
          ) : (
            <Camera className="w-6 h-6 mb-1" />
          )}
          <span className="text-[10px]">
            {compressing ? "..." : "Aggiungi"}
          </span>
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFile}
            disabled={compressing}
            capture="environment" // Ottimizza per la fotocamera posteriore su mobile
          />
        </label>
      </div>
      <p className="text-[10px] text-gray-400">
        Le foto vengono compresse automaticamente.
      </p>
    </div>
  );
};

const Toast = ({
  message,
  visible,
  onClose,
  type = "success",
}: {
  message: string;
  visible: boolean;
  onClose: () => void;
  type?: string;
}) => {
  if (!visible) return null;
  useEffect(() => {
    const timer = setTimeout(onClose, 5000); // Chiudi dopo 5 secondi
    return () => clearTimeout(timer);
  }, [visible, onClose]);

  return (
    <div
      className={`fixed bottom-6 right-6 px-6 py-4 rounded-xl shadow-2xl z-[100] flex items-start gap-4 animate-in slide-in-from-bottom-4 max-w-md ${
        type === "error" ? "bg-red-900 text-white" : "bg-gray-900 text-white"
      }`}
    >
      <div
        className={`rounded-full p-1 mt-1 shrink-0 ${
          type === "error" ? "bg-red-500" : "bg-green-500"
        }`}
      >
        {type === "error" ? (
          <AlertTriangle className="w-4 h-4 text-white" />
        ) : (
          <CheckCircle className="w-4 h-4 text-white" />
        )}
      </div>
      <div>
        <h4 className="font-bold text-sm mb-1">
          {type === "error" ? "Errore" : "Operazione Completata"}
        </h4>
        <p className="text-xs text-gray-300 leading-relaxed whitespace-pre-line">
          {message}
        </p>
      </div>
      <button
        onClick={onClose}
        className="text-gray-500 hover:text-white ml-auto"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

// --- COSTANTI E DATI ---
const CHECKLIST_ITEMS = [
  { id: "libretto", label: "Libretto Circolazione" },
  { id: "assicurazione", label: "Certificato Assicurazione" },
  { id: "card", label: "Carta Carburante" },
  { id: "telepass", label: "Dispositivo Telepass" },
  { id: "manuale", label: "Manuale Uso" },
  { id: "giubbino", label: "Giubbino Catarifrangente" },
  { id: "triangolo", label: "Triangolo" },
];

const FUEL_LEVELS = ["Riserva", "1/4", "1/2", "3/4", "Pieno"];

// Funzione di utilità per il check se il dispositivo è mobile
const isMobileDevice = () => {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  const userAgent = navigator.userAgent || navigator.vendor || window.opera;
  return /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent.toLowerCase());
};

// --- APP PRINCIPALE ---
const App = () => {
  // --- STATO AUTENTICAZIONE e RUOLI ---
  const [authRole, setAuthRole] = useState<"guest" | "admin">("guest");
  const [pinInput, setPinInput] = useState("");
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [view, setView] = useState("dashboard");
  const [user, setUser] = useState<any>(null);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [permissionError, setPermissionError] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchFleetTerm, setSearchFleetTerm] = useState("");
  const [searchDashboardTerm, setSearchDashboardTerm] = useState("");
  const [selectedVehicle, setSelectedVehicle] = useState<any>(null);
  const [modalMode, setModalMode] = useState<string | null>(null);
  const [formData, setFormData] = useState<any>({});
  const [checklist, setChecklist] = useState<any>({});
  const [photos, setPhotos] = useState<any[]>([]);
  const [signature, setSignature] = useState<string | null>(null);

  const [toast, setToast] = useState<ToastState>({
    visible: false,
    message: "",
    type: "success",
  });

  // Stato per il Modale di Conferma (sostituisce alert/confirm)
  const [confirmModal, setConfirmModal] = useState<any>({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: () => {},
  });

  const [generatingPdf, setGeneratingPdf] = useState(false);

  // Helper per mostrare Toast
  const showToast = (message: string, type: string = "success") => {
    setToast({ visible: true, message, type });
  };

  // --- INIZIALIZZAZIONE & AUTH ---
  useEffect(() => {
    loadExternalScripts();
    const initAuth = async () => {
      try {
        if (auth && !auth.currentUser) {
          await signInAnonymously(auth);
        }
      } catch (error) {
        console.error("Auth Error (Anonimo):", error);
        showToast("Errore Autenticazione Anonima.", "error");
      }
      setIsAuthReady(true);
    };
    initAuth();

    const unsubscribeAuth = onAuthStateChanged(auth, (u) => {
      setUser(u);
      const sessionAuth = sessionStorage.getItem("renco_auth_role");
      if (sessionAuth) {
        setAuthRole(sessionAuth as "guest" | "admin");
      }
    });

    return () => unsubscribeAuth();
  }, []);

  // --- CARICAMENTO DATI FIREBASE ---
  useEffect(() => {
    if (!user || authRole === "guest") {
      setLoadingData(false);
      return;
    }

    setLoadingData(true);

    const qVehicles = query(getPublicCollectionPath("vehicles"));
    const unsubVehicles = onSnapshot(
      qVehicles,
      (snapshot) => {
        const vList = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setVehicles(
          vList.sort((a: any, b: any) => a.model.localeCompare(b.model))
        );
        setLoadingData(false);
        setPermissionError(false);
      },
      (err: any) => {
        console.error("Error vehicles:", err);
        if (err.code === "permission-denied") setPermissionError(true);
        setLoadingData(false);
      }
    );

    const qLogs = query(getPublicCollectionPath("logs"));
    const unsubLogs = onSnapshot(
      qLogs,
      (snapshot) => {
        const lList = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setLogs(
          lList.sort(
            (a: any, b: any) =>
              new Date(b.date).getTime() - new Date(a.date).getTime()
          )
        );
      },
      (err) => console.error("Error logs:", err)
    );

    return () => {
      unsubVehicles();
      unsubLogs();
    };
  }, [user, authRole]);

  // Funzione di utilità per formattare la data
  const formatDate = (isoString: string) => {
    return new Date(isoString).toLocaleDateString("it-IT", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // --- EXPORT TO EXCEL HACK (PUNTO 4) ---
  const exportToExcelHack = (data: any[], filename: string) => {
    if (data.length === 0) {
      showToast("Nessun dato da esportare.", "error");
      return;
    }
    
    // Header CSV con colonne importanti
    const headers = [
        "Trip ID", "Tipo Movimento", "Data", "Modello Veicolo", 
        "Targa", "Driver", "Commessa", "Km", "Carburante", "Danni", 
        "Note", ...CHECKLIST_ITEMS.map(item => `Dotazione ${item.label}`)
    ];

    // Mappa i dati log in righe CSV
    const csvRows = data.map(log => {
        const checklistValues = CHECKLIST_ITEMS.map(item => log.checklist?.[item.id] ? "SI" : "NO");
        
        return [
            `#${log.tripId || 'N/A'}`,
            log.type,
            formatDate(log.date),
            log.vehicleModel,
            log.plate,
            log.driver || "N/A",
            log.commessa || "N/A",
            log.km,
            log.fuel,
            log.damages ? log.damages.replace(/"/g, '""') : "", // Escape double quotes
            log.notes ? log.notes.replace(/"/g, '""') : "",
            ...checklistValues
        ].map(field => `"${field}"`).join(';'); // Uso ; come separatore per la compatibilità EU Excel
    });

    const csvContent = [
        headers.join(';'), // Uso ; nel header
        ...csvRows
    ].join('\n');

    // MIME Type e estensione per forzare l'apertura in Excel (Hack)
    const blob = new Blob(["\ufeff", csvContent], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const link = document.createElement("a");
    if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", filename.replace(".csv", ".xls")); // Cambio estensione in .xls
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToast("Storico esportato in formato compatibile Excel.", "success");
    }
  };


  // --- PDF GENERATION (CORRETTA PER MOBILE/PC) ---
  const generatePDF = (logData: any) => {
    if (!window.jspdf) {
      showToast(
        "Libreria PDF non ancora caricata. Riprova tra qualche secondo.",
        "error"
      );
      return;
    }
    setGeneratingPdf(true);
    try {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.width;
      let yPos = 14;

      // Header
      doc.setFillColor(234, 88, 12);
      doc.rect(0, 0, pageWidth, 24, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(20);
      doc.setFont("helvetica", "bold");
      doc.text("RENCO", 14, 16);
      doc.setFontSize(12);
      doc.setFont("helvetica", "normal");
      doc.text("Gestione Flotta Pool", 14 + 30, 16);

      yPos = 40;
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text(`VERBALE DI ${logData.type.toUpperCase()}`, 14, yPos);

      doc.setFontSize(12);
      doc.setTextColor(234, 88, 12);
      doc.text(`Trip ID: #${logData.tripId || "N/A"}`, pageWidth - 60, yPos);

      yPos += 6;
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text(`Data: ${formatDate(logData.date)}`, 14, yPos);

      // Box Dati Veicolo/Driver
      yPos = 55;
      doc.setDrawColor(200, 200, 200);
      doc.setFillColor(250, 250, 250);
      doc.rect(14, yPos, pageWidth - 28, 35, "FD");
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(11);

      // Colonna 1: Veicolo
      doc.setFont("helvetica", "bold");
      doc.text("VEICOLO", 20, yPos + 10);
      doc.setFont("helvetica", "normal");
      doc.text(`${logData.vehicleModel}`, 20, yPos + 17);
      doc.setFont("helvetica", "bold");
      doc.text(`${logData.plate}`, 20, yPos + 23);

      // Colonna 2: Assegnatario
      doc.text("ASSEGNATARIO", 100, yPos + 10);
      doc.setFont("helvetica", "normal");
      doc.text(`${logData.driver || "N/A"}`, 100, yPos + 17);
      // Commessa
      doc.text(
        `Commessa: ${logData.commessa || "N/A"}`,
        100,
        yPos + 23
      );

      // Colonna 3: Stato
      doc.setFont("helvetica", "bold");
      doc.text("KM/FUEL", 160, yPos + 10);
      doc.setFont("helvetica", "normal");
      doc.text(`${logData.km} km`, 160, yPos + 17);
      doc.text(`Fuel: ${logData.fuel}`, 160, yPos + 23);

      yPos += 50;

      // Sezione Dotazioni (Checklist)
      if (logData.checklist && Object.keys(logData.checklist).length > 0) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.text("DOTAZIONI E DOCUMENTI", 14, yPos);
        yPos += 8;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        const items = CHECKLIST_ITEMS;
        items.forEach((item, index) => {
          const isPresent = logData.checklist[item.id];
          
          // NUOVO: Colore e testo esplicito (Verde [SI] / Rosso [NO])
          const checkText = isPresent ? "[SI]" : "[NO]"; 
          // Colore BGR (Verde BGR 100, 200, 100; Rosso BGR 200, 100, 100)
          const textColor = isPresent ? [0, 150, 0] : [200, 0, 0]; // RGB
          
          doc.setTextColor(...textColor); 
          
          doc.text(`${checkText} ${item.label}`, 14 + (index % 2) * 90, yPos);
          if (index % 2 === 1) yPos += 6;
        });
        if (items.length % 2 === 1) yPos += 6; // Se dispari, aggiungi spazio
        yPos += 4;
      }

      // Sezione Note e Segnalazioni
      doc.setTextColor(0, 0, 0); // Reset colore testo
      if (logData.notes || logData.damages) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.text("NOTE E SEGNALAZIONI", 14, yPos);
        yPos += 8;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        
        if (logData.damages) {
          doc.setTextColor(200, 0, 0);
          doc.text(`DANNI: ${logData.damages}`, 14, yPos);
          yPos += 6;
        }
        if (logData.notes) {
          doc.setTextColor(0, 0, 0);
          doc.text(`Note: ${logData.notes}`, 14, yPos);
          yPos += 6;
        }
        yPos += 4;
      }

      // Sezione Foto Allegati
      if (logData.photos && logData.photos.length > 0) {
        doc.setTextColor(0, 0, 0); // Reset colore testo
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.text("FOTO ALLEGATE", 14, yPos);
        yPos += 8;
        
        let xOffset = 14;
        const photoWidth = 50;
        const photoHeight = 50;

        logData.photos.forEach((photo: string, i: number) => {
          if (xOffset + photoWidth > pageWidth - 14) {
            // Se non c'è più spazio orizzontale
            xOffset = 14;
            yPos += photoHeight + 5; // Nuova riga
          }
          if (yPos + photoHeight > 270) { // Controlla fine pagina
            doc.addPage();
            yPos = 20;
            xOffset = 14;
            doc.setFontSize(10);
            doc.text(`FOTO ALLEGATE (Continua) - Pagina ${doc.internal.pages.length - 1}`, 14, yPos);
            yPos += 8;
          }
          
          try {
            doc.addImage(photo, "JPEG", xOffset, yPos, photoWidth, photoHeight);
            xOffset += photoWidth + 5;
          } catch (e) {
            console.warn("Errore aggiunta immagine al PDF", e);
          }
        });
        yPos += photoHeight + 10;
      }

      // Sezione Firma
      if (logData.signature) {
        if (yPos > 240) { // Inserisce in una nuova pagina se non c'è spazio
          doc.addPage();
          yPos = 20;
        }
        
        doc.setDrawColor(0, 0, 0);
        doc.line(14, yPos, pageWidth - 14, yPos);
        yPos += 10;
        
        // Testo Firma in nero
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.setTextColor(0, 0, 0); 
        doc.text("FIRMA PER ACCETTAZIONE", 14, yPos);
        
        try {
          doc.addImage(logData.signature, "PNG", 14, yPos + 5, 60, 30);
        } catch (e) {
          console.warn("Errore aggiunta firma al PDF", e);
        }

        yPos += 45;

        // Disclaimer (sempre in fondo)
        doc.setFontSize(8);
        doc.setFont("helvetica", "italic");
        doc.setTextColor(100, 100, 100);
        doc.text(
          "In caso di danneggiamento la società si riserva il diritto di addebitare il costo di riparazione al dipendente,",
          14,
          yPos
        );
        doc.text(
          "nel caso in cui il danno ammonti ad un valore superiore ai 500€, nella misura del 20% dell'importo totale.",
          14,
          yPos + 4
        );
      }
      
      const dateStr = new Date(logData.date).toISOString().slice(0, 10);
      const idStr = logData.tripId ? `_TRIP-${logData.tripId}` : "";
      const filename = `${logData.plate}_${dateStr}${idStr}_${logData.type}.pdf`;

      // LOGICA DI DOWNLOAD (Mobile vs PC)
      if (isMobileDevice()) {
          // Mobile: Apre direttamente in una nuova finestra/scheda con nome file
          doc.output('dataurlnewwindow', {filename: filename}); 
          setTimeout(() => {
              showToast(`Verbale PDF generato e aperto per la condivisione.`, "success");
          }, 500);
      } else {
          // PC: Download diretto
          doc.save(filename);
          showToast(`Verbale PDF scaricato.`, "success");
      }

    } catch (err) {
      console.error(err);
      showToast("Errore generazione PDF", "error");
    } finally {
      setGeneratingPdf(false);
    }
  };

  // --- LOGIN HANDLER (PUNTO 1) ---
  const handleLogin = (e: any) => {
    e.preventDefault();
    if (pinInput === PIN_UNICO) {
      setAuthRole("admin");
      sessionStorage.setItem("renco_auth_role", "admin");
    } else {
      showToast("PIN Errato!", "error");
      setPinInput("");
    }
  };

  const handleLogout = () => {
    setAuthRole("guest");
    sessionStorage.removeItem("renco_auth_role");
  };

  // --- ACTIONS ---
  const handleTransaction = async (e: any) => {
    e.preventDefault();
    if (!signature || !db) {
      showToast("Firma obbligatoria.", "error");
      return;
    }

    const type = modalMode === "checkout" ? "Consegna" : "Ritiro";
    const newStatus = modalMode === "checkout" ? "impegnato" : "disponibile";

    if (
      modalMode === "checkin" &&
      parseInt(formData.km) < selectedVehicle.km
    ) {
      showToast(
        `I Km inseriti (${formData.km}) devono essere maggiori o uguali a quelli di uscita (${selectedVehicle.km}).`,
        "error"
      );
      return;
    }

    try {
      let tripId = selectedVehicle.currentTripId || null;

      if (modalMode === "checkout") {
        tripId = await getNextTripId(db);
      }

      const safeTripId = tripId || "N/A";

      const logData = {
        tripId: safeTripId,
        commessa:
          modalMode === "checkout"
            ? formData.commessa || null
            : selectedVehicle.commessa || null,
        type,
        vehicleId: selectedVehicle.id,
        vehicleModel: selectedVehicle.model,
        plate: selectedVehicle.plate,
        driver:
          modalMode === "checkout" ? formData.driver : selectedVehicle.driver,
        date: new Date().toISOString(),
        km: parseInt(formData.km) || selectedVehicle.km,
        fuel: formData.fuel,
        notes: formData.notes || "",
        damages: formData.damages || "",
        checklist,
        photos,
        signature,
      };

      const vehicleRef = getPublicDocRef("vehicles", selectedVehicle.id);
      await updateDoc(vehicleRef, {
        status: newStatus,
        driver: modalMode === "checkout" ? formData.driver : null,
        km: parseInt(formData.km) || selectedVehicle.km,
        fuel: formData.fuel,
        currentTripId: modalMode === "checkout" ? tripId : null,
        commessa: modalMode === "checkout" ? formData.commessa : null,
      });

      await addDoc(getPublicCollectionPath("logs"), logData);
      
      // La generazione del PDF è stata spostata qui e usa showToast
      generatePDF(logData); 

      // Se è un check-in e ci sono danni/note, invia notifica email
      if (modalMode === "checkin" && (formData.damages || formData.notes) && window.emailjs) {
        await sendDamageNotification(logData);
      }

      closeModal();
      showToast(`${type} completata con successo!`, "success");
    } catch (err) {
      console.error(err);
      showToast("Errore salvataggio su Cloud.", "error");
    }
  };

  const sendDamageNotification = async (logData: any) => {
    if (!EMAILJS_CONFIG.SERVICE_ID || !EMAILJS_CONFIG.TEMPLATE_ID) {
      console.warn("EmailJS non configurato. Salto l'invio email.");
      return;
    }

    const templateParams = {
      trip_id: logData.tripId,
      vehicle_model: logData.vehicleModel,
      plate: logData.plate,
      driver_name: logData.driver,
      km: logData.km,
      date: formatDate(logData.date),
      damages: logData.damages || "Nessun danno grave segnalato.",
      notes: logData.notes || "Nessuna nota aggiuntiva.",
    };

    try {
      const response = await window.emailjs.send(
        EMAILJS_CONFIG.SERVICE_ID,
        "template_g250j58", // Usando un template generico se TEMPLATE_ID è vuoto, altrimenti usa il tuo
        templateParams
      );
      console.log("Email inviata con successo:", response);
      showToast("Notifica danni inviata via email.", "success");
    } catch (error) {
      console.error("Errore nell'invio dell'email:", error);
      showToast("Attenzione: Impossibile inviare la notifica via email.", "error");
    }
  };

  // --- Add/Edit Vehicle (PUNTO 3: GESTIONE FOTO BASE64) ---
  const handleAddVehicle = async (e: any) => {
    e.preventDefault();
    if (authRole !== "admin" || !db) return;
    try {
      await addDoc(getPublicCollectionPath("vehicles"), {
        model: formData.model,
        plate: formData.plate.toUpperCase(),
        km: parseInt(formData.km),
        imageUrl: formData.imageUrl || null, // Immagine Base64
        status: "disponibile",
        fuel: "Pieno",
        driver: null,
        currentTripId: null,
        commessa: null,
      });
      closeModal();
      showToast("Veicolo aggiunto.", "success");
    } catch (err) {
      console.error(err);
      showToast("Errore salvataggio.", "error");
    }
  };

  const handleEditVehicle = async (e: any) => {
    e.preventDefault();
    if (authRole !== "admin" || !db || !selectedVehicle) return;
    try {
      const vehicleRef = getPublicDocRef("vehicles", selectedVehicle.id);
      await updateDoc(vehicleRef, {
        model: formData.model,
        plate: formData.plate.toUpperCase(),
        km: parseInt(formData.km),
        imageUrl: formData.imageUrl || null, // Immagine Base64
      });
      closeModal();
      showToast("Dati veicolo aggiornati.", "success");
    } catch (err) {
      console.error(err);
      showToast("Errore aggiornamento.", "error");
    }
  };

  const deleteVehicle = async (id: string) => {
    if (authRole !== "admin" || !db) return;

    setConfirmModal({
      isOpen: true,
      title: "Conferma Eliminazione",
      message:
        "Sei sicuro di voler eliminare permanentemente questo veicolo? L'operazione è irreversibile.",
      onConfirm: async () => {
        setConfirmModal({ isOpen: false });
        try {
          await deleteDoc(getPublicDocRef("vehicles", id));
          showToast("Veicolo eliminato.", "success");
        } catch (err) {
          showToast("Errore eliminazione.", "error");
        }
      },
      onCancel: () => setConfirmModal({ isOpen: false }),
    });
  };

  // --- RENDER HELPER ---
  const renderChecklist = () => (
    <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
      <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
        <FileText className="w-4 h-4" /> Dotazioni
      </label>
      <div className="grid grid-cols-2 gap-2">
        {CHECKLIST_ITEMS.map((item) => (
          <label
            key={item.id}
            className="flex items-center space-x-2 text-sm cursor-pointer"
          >
            <input
              type="checkbox"
              className="rounded text-orange-600 border-gray-300 focus:ring-orange-500"
              checked={checklist[item.id] || false}
              onChange={(e) =>
                setChecklist({ ...checklist, [item.id]: e.target.checked })
              }
            />
            <span>{item.label}</span>
          </label>
        ))}
      </div>
    </div>
  );

  const renderFuelSelector = () => (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        Carburante
      </label>
      <div className="flex rounded-lg shadow-inner bg-gray-100 p-1">
        {FUEL_LEVELS.map((level) => (
          <button
            key={level}
            type="button"
            onClick={() => setFormData({ ...formData, fuel: level })}
            className={`flex-1 py-2 text-xs font-medium rounded-lg transition-all ${
              formData.fuel === level
                ? "bg-white text-orange-600 shadow-md ring-1 ring-orange-500"
                : "text-gray-500 hover:bg-gray-200"
            }`}
          >
            {level}
          </button>
        ))}
      </div>
    </div>
  );

  const openModal = (mode: string, vehicle: any = null) => {
    // Solo Admin può aggiungere/modificare
    if (
      (mode === "add" || mode === "edit") &&
      authRole !== "admin"
    ) {
      showToast("Accesso negato: solo gli amministratori possono modificare la flotta.", "error");
      return;
    }
    setModalMode(mode);
    setSelectedVehicle(vehicle);
    const initCheck: any = {};
    CHECKLIST_ITEMS.forEach((i) => (initCheck[i.id] = true));
    setChecklist(initCheck);
    setPhotos([]);
    setSignature(null);

    // Pre-fill per Edit o Transaction
    if (vehicle) {
      setFormData({
        model: vehicle.model,
        plate: vehicle.plate,
        km: vehicle.km,
        fuel: vehicle.fuel || "Pieno",
        driver: vehicle.driver || "",
        commessa: vehicle.commessa || "",
        imageUrl: vehicle.imageUrl || "", // Carica l'immagine Base64 esistente
      });
    } else {
      setFormData({
        imageUrl: "", // Inizializza l'immagine Base64
      });
    }
  };
  const closeModal = () => {
    setModalMode(null);
    setSelectedVehicle(null);
    setFormData({});
  };

  // --- VIEWS ---
  const renderLogin = () => (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-sm text-center border-t-4 border-orange-600">
        <div className="w-16 h-16 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <Lock className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-bold text-gray-800 mb-2">
          Accesso Renco Fleet
        </h1>
        <p className="text-gray-500 mb-6 text-sm">
          Inserisci il PIN per accedere come Amministratore.
        </p>

        <form onSubmit={handleLogin} className="space-y-4">
          <input
            type="password"
            className="w-full text-center text-2xl tracking-widest p-3 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none font-mono"
            placeholder="PIN"
            value={pinInput}
            onChange={(e) => setPinInput(e.target.value)}
            autoFocus
          />
          <Button type="submit" className="w-full justify-center">
            <LogIn className="w-4 h-4" /> Accedi
          </Button>
        </form>
      </div>
    </div>
  );

  const renderDashboard = () => {
    const isUser = authRole === "admin";
    
    // Filtra i veicoli in base alla ricerca Dashboard
    const filteredVehicles = vehicles.filter(
      (v) =>
        v.plate?.toLowerCase().includes(searchDashboardTerm.toLowerCase()) ||
        v.model?.toLowerCase().includes(searchDashboardTerm.toLowerCase()) ||
        v.driver?.toLowerCase().includes(searchDashboardTerm.toLowerCase())
    );

    const available = filteredVehicles.filter(
      (v) => v.status === "disponibile"
    ).length;
    const busy = filteredVehicles.filter(
      (v) => v.status === "impegnato"
    ).length;

    return (
      <div className="space-y-6">
        {permissionError && (
          <div className="bg-red-100 p-4 text-red-800 rounded-xl border border-red-200 flex items-center gap-3 font-medium">
            <ShieldAlert className="w-5 h-5" /> Errore Permessi Database: I dati
            potrebbero non essere aggiornati in tempo reale.
          </div>
        )}

        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <h2 className="text-2xl font-bold text-gray-800">Dashboard Flotta</h2>

          <div className="flex items-center gap-3">
            {/* Barra Ricerca Dashboard */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                className="pl-9 pr-4 py-2 border rounded-full text-sm focus:ring-2 focus:ring-orange-500 outline-none w-full md:w-64 transition-all"
                placeholder="Cerca targa, modello, driver..."
                value={searchDashboardTerm}
                onChange={(e) => setSearchDashboardTerm(e.target.value)}
                disabled={!isUser || loadingData}
              />
            </div>
            <div className="flex items-center gap-2 text-green-600 text-xs font-medium bg-white px-3 py-1.5 rounded-full border border-green-200 shadow-sm">
              <Zap className="w-3 h-3 animate-pulse" /> Live Sync
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="p-4 border-l-4 border-orange-500 flex items-center gap-3">
            <Car className="w-8 h-8 text-orange-600 bg-orange-100 p-1 rounded-full shrink-0" />
            <div>
              <p className="text-sm text-gray-500">Totale Veicoli</p>
              <h3 className="text-2xl font-bold">
                {loadingData ? <Loader2 className="w-6 h-6 animate-spin" /> : filteredVehicles.length}
              </h3>
            </div>
          </Card>
          <Card className="p-4 border-l-4 border-green-500 flex items-center gap-3">
            <CheckCircle className="w-8 h-8 text-green-600 bg-green-100 p-1 rounded-full shrink-0" />
            <div>
              <p className="text-sm text-gray-500">Disponibili</p>
              <h3 className="text-2xl font-bold">{available}</h3>
            </div>
          </Card>
          <Card className="p-4 border-l-4 border-red-500 flex items-center gap-3">
            <Users className="w-8 h-8 text-red-600 bg-red-100 p-1 rounded-full shrink-0" />
            <div>
              <p className="text-sm text-gray-500">In Uso</p>
              <h3 className="text-2xl font-bold">{busy}</h3>
            </div>
          </Card>
        </div>
        
        {loadingData && (
          <div className="text-center p-8 text-gray-500">
             <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" /> Caricamento dati...
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-4">
          {filteredVehicles
            .filter((v) => v.status === "disponibile")
            .map((v) => (
              <Card
                key={v.id}
                className="p-4 hover:shadow-lg transition-shadow flex justify-between items-center"
              >
                <div className="flex items-center gap-3">
                  {v.imageUrl ? (
                    <img
                      src={v.imageUrl}
                      alt={v.model}
                      className="w-10 h-10 object-cover rounded-full shrink-0 border border-green-300"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.onerror = null;
                        target.src = "https://placehold.co/40x40/059669/ffffff?text=C";
                      }}
                    />
                  ) : (
                    <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center shrink-0">
                      <Car className="text-green-600 w-5 h-5" />
                    </div>
                  )}
                  <div>
                    <h4 className="font-bold">{v.model}</h4>
                    <p className="text-sm text-gray-500">{v.plate}</p>
                    <p className="text-xs text-gray-400 mt-0.5">Km: {v.km} | Fuel: {v.fuel}</p>
                  </div>
                </div>
                <Button 
                  onClick={() => openModal("checkout", v)}
                  className="w-auto px-6 py-2"
                  disabled={!isUser}
                >
                  Consegna <ArrowRight className="w-4 h-4" />
                </Button>
              </Card>
            ))}
          {filteredVehicles
            .filter((v) => v.status === "impegnato")
            .map((v) => (
              <Card
                key={v.id}
                className="p-4 border-l-4 border-red-200 bg-red-50/30 flex justify-between items-center"
              >
                <div className="flex items-center gap-3">
                  {v.imageUrl ? (
                    <img
                      src={v.imageUrl}
                      alt={v.model}
                      className="w-10 h-10 object-cover rounded-full shrink-0 border border-red-300"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.onerror = null;
                        target.src = "https://placehold.co/40x40/dc2626/ffffff?text=C";
                      }}
                    />
                  ) : (
                    <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center shrink-0">
                      <User className="text-red-600 w-5 h-5" />
                    </div>
                  )}
                  <div>
                    <h4 className="font-bold">{v.model}</h4>
                    <p className="text-sm text-gray-700">
                      <span className="font-mono font-bold mr-1">
                        {v.plate}
                      </span>
                      • {v.driver}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Trip #{v.currentTripId} {v.commessa ? `(Commessa: ${v.commessa})` : ''}
                    </p>
                  </div>
                </div>
                <Button
                  variant="secondary"
                  onClick={() => openModal("checkin", v)}
                  className="w-auto px-6 py-2"
                  disabled={!isUser}
                >
                  Rientro
                </Button>
              </Card>
            ))}
        </div>
      </div>
    );
  };

  const renderFleet = () => {
    const isManager = authRole === "admin";
    
    const filteredFleet = vehicles.filter(
      (v) =>
        v.plate?.toLowerCase().includes(searchFleetTerm.toLowerCase()) ||
        v.model?.toLowerCase().includes(searchFleetTerm.toLowerCase())
    );
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h2 className="text-2xl font-bold">Gestione Flotta</h2>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                className="pl-9 pr-4 py-2 border rounded-lg w-full"
                placeholder="Cerca targa/modello..."
                value={searchFleetTerm}
                onChange={(e) => setSearchFleetTerm(e.target.value)}
                disabled={!isManager}
              />
            </div>
            <Button onClick={() => openModal("add")} className="w-auto px-6" disabled={!isManager}>
              <Plus className="w-4 h-4" /> Nuovo
            </Button>
          </div>
        </div>
        <Card>
          {loadingData ? (
            <div className="text-center p-8 text-gray-500">
              <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" /> Caricamento flotta...
            </div>
          ) : (
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 border-b">
                <tr className="text-gray-600 uppercase tracking-wider">
                  <th className="p-3">Modello</th>
                  <th className="p-3">Targa</th>
                  <th className="p-3">Km</th>
                  <th className="p-3">Stato</th>
                  <th className="p-3">Driver</th>
                  <th className="p-3 text-right">Azioni</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredFleet.map((v) => (
                  <tr key={v.id} className="hover:bg-gray-50 transition-colors">
                    <td className="p-3 font-medium flex items-center gap-2">
                        {v.imageUrl ? (
                          <img
                            src={v.imageUrl}
                            alt={v.model}
                            className="w-6 h-6 object-cover rounded-full border"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.onerror = null;
                              target.src = "https://placehold.co/24x24/10b981/ffffff?text=C";
                            }}
                          />
                        ) : (
                          <Car className="w-5 h-5 text-gray-500" />
                        )}
                        {v.model}
                    </td>
                    <td className="p-3 font-mono text-gray-700">{v.plate}</td>
                    <td className="p-3 text-gray-600">{v.km}</td>
                    <td className="p-3">
                      <Badge status={v.status} />
                    </td>
                    <td className="p-3 text-gray-500 text-xs">
                      {v.status === "impegnato" ? (v.driver || "N/A") : "-"}
                    </td>
                    <td className="p-3 text-right flex justify-end gap-2">
                      <button
                        onClick={() => openModal("edit", v)}
                        className="text-blue-500 hover:bg-blue-50 p-2 rounded-full disabled:opacity-50"
                        title="Modifica"
                        disabled={!isManager}
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => deleteVehicle(v.id)}
                        className="text-red-500 hover:bg-red-50 p-2 rounded-full disabled:opacity-50"
                        title="Elimina"
                        disabled={!isManager}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>
    );
  };

  const renderHistory = () => {
    // Raggruppa per Trip ID
    const filteredLogs = logs.filter(
      (l) =>
        l.driver?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        l.plate?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        l.tripId?.includes(searchTerm)
    );
    
    // Aggregazione in un unico oggetto per Trip ID
    const trips: any = {};
    filteredLogs.forEach((log) => {
      const tid = log.tripId || "LEGACY";
      if (!trips[tid]) trips[tid] = { id: tid, logs: [] };
      trips[tid].logs.push(log);
    });
    
    // Ordina i Trip ID in base alla data del log più recente nel trip
    const sortedTripIds = Object.keys(trips).sort((a, b) => {
      const logsA = trips[a].logs;
      const logsB = trips[b].logs;
      const latestDateA = logsA.reduce((max: Date, log: any) => 
        (new Date(log.date).getTime() > max.getTime() ? new Date(log.date) : max), new Date(0));
      const latestDateB = logsB.reduce((max: Date, log: any) => 
        (new Date(log.date).getTime() > max.getTime() ? new Date(log.date) : max), new Date(0));
      return latestDateB.getTime() - latestDateA.getTime();
    });
    
    // Estrae tutti i log filtrati per l'esportazione
    const allFilteredLogs = sortedTripIds.flatMap(tid => trips[tid].logs);


    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h2 className="text-2xl font-bold">Storico Viaggi</h2>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                className="pl-9 pr-4 py-2 border rounded-lg w-full"
                placeholder="Cerca Targa, Driver o Trip ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                disabled={loadingData}
              />
            </div>
            {/* PUNTO 4: Bottone di Esportazione Excel (.xls) */}
            <Button
              onClick={() => exportToExcelHack(allFilteredLogs, `Renco_Storico_${new Date().toISOString().slice(0, 10)}.xls`)}
              className="w-auto px-4 py-2 text-sm"
              variant="secondary"
              disabled={loadingData || allFilteredLogs.length === 0}
            >
              <Download className="w-4 h-4" /> Esporta Excel
            </Button>
          </div>
        </div>

        {loadingData ? (
          <div className="text-center p-8 text-gray-500">
              <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" /> Caricamento storico movimenti...
          </div>
        ) : (
          <div className="space-y-6">
            {sortedTripIds.map((tid) => {
              const trip = trips[tid];
              // Un trip è chiuso se contiene sia Consegna che Ritiro, o solo Consegna (ancora in corso)
              const checkinLog = trip.logs.find((l: any) => l.type === "Ritiro");
              const checkoutLog = trip.logs.find((l: any) => l.type === "Consegna");
              const isClosed = !!checkinLog;
              const mainLog = checkoutLog || trip.logs[0]; // Usa il checkout come principale se esiste

              return (
                <div
                  key={tid}
                  className={`bg-white rounded-xl shadow-md border-l-4 overflow-hidden transition-all duration-300 ${
                    isClosed ? "border-green-500" : "border-orange-500"
                  }`}
                >
                  <div className="bg-gray-50 p-4 border-b flex flex-col sm:flex-row justify-between items-start sm:items-center">
                    <div>
                      <h4 className="font-bold text-gray-800 flex items-center gap-2">
                        <Car className="w-4 h-4" /> TRIP ID: #{tid}
                        {isClosed ? (
                          <span className="bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full font-medium">
                            Completato
                          </span>
                        ) : (
                          <span className="bg-orange-100 text-orange-700 text-xs px-2 py-0.5 rounded-full font-medium">
                            In Corso
                          </span>
                        )}
                      </h4>
                      <div className="text-sm text-gray-600 mt-1">
                        **{mainLog.vehicleModel}** - {mainLog.plate} |{" "}
                        Driver: **{mainLog.driver}**
                        {mainLog.commessa && (
                          <span className="ml-2 text-gray-500 text-xs">
                            (Commessa: {mainLog.commessa})
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {trip.logs
                      .sort(
                        (a: any, b: any) =>
                          new Date(a.date).getTime() - new Date(b.date).getTime()
                      )
                      .map((l: any, index: number) => (
                        <div
                          key={l.id}
                          className="p-3 flex justify-between items-center hover:bg-gray-50 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={`p-2 rounded-full shrink-0 ${
                                l.type === "Consegna"
                                  ? "bg-blue-50 text-blue-600"
                                  : "bg-purple-50 text-purple-600"
                              }`}
                            >
                              {l.type === "Consegna" ? (
                                <ArrowRight className="w-4 h-4" />
                              ) : (
                                <CheckCircle className="w-4 h-4" />
                              )}
                            </div>
                            <div>
                              <div className="font-medium text-sm">
                                {l.type} - {l.driver}
                                {l.damages && <span className="text-red-500 ml-2 font-bold">(Danni Segnalati)</span>}
                              </div>
                              <div className="text-xs text-gray-500 mt-0.5">
                                {formatDate(l.date)} - Km: {l.km} - Fuel: {l.fuel}
                              </div>
                            </div>
                          </div>
                          <button
                            onClick={() => generatePDF(l)}
                            className="text-orange-600 hover:text-orange-800 text-xs flex items-center gap-1 font-medium transition-colors p-2 rounded hover:bg-orange-50 shrink-0"
                            disabled={generatingPdf}
                          >
                            {generatingPdf ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileDown className="w-3 h-3" />} PDF
                          </button>
                        </div>
                      ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const renderModal = () => {
    if (!modalMode) return null;
    const isCheckout = modalMode === "checkout";
    const isEdit = modalMode === "edit";
    const isAdd = modalMode === "add";

    return (
      <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm">
        <div className="flex min-h-full items-center justify-center p-4 text-center">
          <Card className="w-full max-w-lg max-h-[90vh] transform text-left align-middle transition-all overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-start border-b pb-4 mb-4 sticky top-0 bg-white z-10">
                <h3 className="text-xl font-extrabold text-gray-900 flex items-center gap-3">
                  {isAdd && <Plus className="w-5 h-5 text-orange-600" />}
                  {isEdit && <Pencil className="w-5 h-5 text-blue-600" />}
                  {isCheckout && <ArrowRight className="w-5 h-5 text-green-600" />}
                  {modalMode === "checkin" && <CheckCircle className="w-5 h-5 text-red-600" />}
                  
                  {isAdd
                    ? "Nuovo Veicolo"
                    : isEdit
                    ? `Modifica Veicolo: ${selectedVehicle?.model}`
                    : `${isCheckout ? "Consegna" : "Rientro"}: ${
                        selectedVehicle?.model
                      }`}
                </h3>
                <button
                  type="button"
                  onClick={closeModal}
                  className="p-1 rounded-full hover:bg-gray-100 text-gray-500 hover:text-gray-900"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* MODULO AGGIUNTA o MODIFICA VEICOLO */}
              {isAdd || isEdit ? (
                <form
                  onSubmit={isAdd ? handleAddVehicle : handleEditVehicle}
                  className="space-y-4"
                >
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Modello
                    </label>
                    <input
                      className="w-full border p-3 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
                      placeholder="Es. Fiat Panda"
                      value={formData.model || ""}
                      onChange={(e) =>
                        setFormData({ ...formData, model: e.target.value })
                      }
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Targa
                    </label>
                    <input
                      className="w-full border p-3 rounded-lg uppercase font-mono tracking-wider focus:ring-2 focus:ring-orange-500 outline-none"
                      placeholder="Es. AA000BB"
                      value={formData.plate || ""}
                      onChange={(e) =>
                        setFormData({ ...formData, plate: e.target.value })
                      }
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Km Attuali
                    </label>
                    <input
                      className="w-full border p-3 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
                      type="number"
                      value={formData.km || ""}
                      onChange={(e) =>
                        setFormData({ ...formData, km: e.target.value })
                      }
                      required
                      min={0}
                    />
                  </div>
                  {/* Componente per l'upload di una singola foto Base64 */}
                  <VehiclePhotoUpload 
                    imageUrl={formData.imageUrl} 
                    setImageUrl={(url: string) => setFormData({...formData, imageUrl: url})} 
                    onShowToast={showToast}
                  />
                  
                  <div className="flex gap-3 pt-2">
                    <Button variant="secondary" onClick={closeModal}>
                      Annulla
                    </Button>
                    <Button type="submit">
                      {isAdd ? "Salva Veicolo" : "Aggiorna Dati"}
                    </Button>
                  </div>
                </form>
              ) : (
                // MODULO MOVIMENTI (Check-in / Check-out)
                <form onSubmit={handleTransaction} className="space-y-4">
                  {/* Riepilogo Dati Uscita (solo Check-in) */}
                  {modalMode === "checkin" && selectedVehicle && (
                    <div className="grid grid-cols-2 gap-4 bg-orange-50 p-4 rounded-xl border border-orange-200">
                      <div>
                        <span className="text-xs text-orange-700 uppercase font-bold">
                          Driver Uscita
                        </span>
                        <br />
                        <strong className="text-gray-900 text-lg">
                          {selectedVehicle.driver || "N/A"}
                        </strong>
                        <p className="text-xs text-gray-600 mt-1">
                            Commessa: {selectedVehicle.commessa || "N/A"}
                        </p>
                      </div>
                      <div>
                        <span className="text-xs text-orange-700 uppercase font-bold">
                          Km Uscita
                        </span>
                        <br />
                        <strong className="text-gray-900 text-lg">
                          {selectedVehicle.km} km
                        </strong>
                        <p className="text-xs text-gray-600 mt-1">
                          Fuel: {selectedVehicle.fuel}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Dati Obbligatori (Driver / Km Attuali) */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {isCheckout && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Nome Cognome Driver
                        </label>
                        <input
                          className="w-full border p-3 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
                          placeholder="Es. Mario Rossi"
                          value={formData.driver || ""}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              driver: e.target.value,
                            })
                          }
                          required
                        />
                      </div>
                    )}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Km Attuali (Obbligatorio)
                      </label>
                      <input
                        type="number"
                        className="w-full border p-3 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
                        value={formData.km || ""}
                        onChange={(e) =>
                          setFormData({ ...formData, km: e.target.value })
                        }
                        required
                        min={selectedVehicle?.km || 0}
                      />
                      {modalMode === "checkin" && parseInt(formData.km) < selectedVehicle?.km && (
                        <p className="text-xs text-red-500 mt-1">
                          Attenzione: Km inferiori a quelli di uscita.
                        </p>
                      )}
                    </div>
                  </div>
                  
                  {/* Commessa (solo Check-out) */}
                  {isCheckout && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Commessa (Opzionale)
                      </label>
                      <input
                        className="w-full border p-3 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
                        placeholder="Es. 23-050"
                        value={formData.commessa || ""}
                        onChange={(e) =>
                          setFormData({ ...formData, commessa: e.target.value })
                        }
                      />
                    </div>
                  )}

                  {renderFuelSelector()}
                  {renderChecklist()}
                  <div className="bg-red-50 p-3 rounded-lg border border-red-100">
                    <label className="text-sm font-bold text-red-700 flex items-center gap-1 mb-2">
                      <AlertTriangle className="w-4 h-4" />{" "}
                      {isCheckout
                        ? "Danni Preesistenti (Opzionale)"
                        : "Nuovi Danni / Anomalie (Importante)"}
                    </label>
                    <textarea
                      className="w-full p-2 border border-red-200 rounded-lg bg-white text-sm focus:ring-2 focus:ring-red-500 outline-none"
                      rows={2}
                      value={formData.damages || ""}
                      onChange={(e) =>
                        setFormData({ ...formData, damages: e.target.value })
                      }
                      placeholder={
                        isCheckout
                          ? "Segnala graffi o danni già presenti (Opzionale)..."
                          : "Descrivi chiaramente eventuali nuovi danni o anomalie riscontrate (Obbligatorio se presenti)..."
                      }
                    ></textarea>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Note Generali (Opzionale)
                    </label>
                    <textarea
                      className="w-full p-3 border rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                      rows={1}
                      value={formData.notes || ""}
                      onChange={(e) =>
                        setFormData({ ...formData, notes: e.target.value })
                      }
                      placeholder="Altre info utili..."
                    ></textarea>
                  </div>
                  <PhotoUpload photos={photos} setPhotos={setPhotos} onShowToast={showToast} />
                  <SignaturePad
                    onSave={setSignature}
                    label="Firma Driver per Accettazione"
                    disclaimer={
                      isCheckout
                        ? "In caso di danneggiamento la società si riserva il diritto di addebitare il costo di riparazione al dipendente, nel caso in cui il danno ammonti ad un valore superiore ai 500€, nella misura del 20% dell'importo totale."
                        : null
                    }
                  />
                  <div className="flex gap-3 pt-4 sticky bottom-0 bg-white border-t pt-4">
                    <Button variant="secondary" onClick={closeModal}>
                      Annulla
                    </Button>
                    <Button type="submit" loading={generatingPdf} disabled={generatingPdf}>
                      {generatingPdf ? 'Generazione PDF...' : isCheckout ? "Conferma Consegna" : "Conferma Rientro"}
                    </Button>
                  </div>
                </form>
              )}
            </div>
          </Card>
        </div>
      </div>
    );
  };

  // Se l'auth non è pronto, mostra un loader iniziale (opzionale)
  if (!isAuthReady || authRole === "guest") {
    if (!isAuthReady) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
          <Loader2 className="w-8 h-8 animate-spin text-orange-600" />
        </div>
      );
    }
    return renderLogin();
  }

  // Tutti gli utenti autenticati sono "admin" e possono vedere tutto
  const availableViews = ["dashboard", "flotta", "storico"];

  return (
    <div className="min-h-screen bg-slate-50 pb-20 font-sans text-slate-900">
      <Toast
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        onClose={() => setToast({ ...toast, visible: false })}
      />
      <header className="bg-slate-900 text-white p-4 shadow-lg sticky top-0 z-30">
        <div className="max-w-5xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="bg-orange-600 w-10 h-10 rounded flex items-center justify-center font-bold text-xl">
              R
            </div>
            <h1 className="text-xl font-bold hidden sm:block">Renco Fleet Management</h1>
            <span className="text-xs bg-orange-700 px-2 py-0.5 rounded-full font-medium ml-2 uppercase">
              Admin
            </span>
          </div>
          <button
            onClick={handleLogout}
            className="text-sm text-gray-400 hover:text-white flex items-center gap-2 transition-colors"
          >
            <LogIn className="w-4 h-4 rotate-180" /> Esci
          </button>
        </div>
      </header>
      <div className="max-w-5xl mx-auto px-4 mt-6">
        <nav className="flex gap-2 mb-6 bg-white p-1 rounded-xl shadow w-fit">
          {availableViews.map((t) => (
            <button
              key={t}
              onClick={() => setView(t)}
              className={`px-4 py-2 rounded-lg capitalize text-sm font-medium transition-colors ${
                view === t
                  ? "bg-orange-600 text-white shadow-md"
                  : "text-slate-500 hover:bg-slate-50"
              }`}
            >
              {t}
            </button>
          ))}
        </nav>
        <main className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          {view === "dashboard" && renderDashboard()}
          {view === "flotta" && renderFleet()}
          {view === "storico" && renderHistory()}
        </main>
      </div>
      {renderModal()}
      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        onConfirm={confirmModal.onConfirm}
        onCancel={confirmModal.onCancel}
      />
    </div>
  );
};

export default App;