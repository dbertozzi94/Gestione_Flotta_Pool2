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
  Maximize,
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
    opera?: any;
    XLSX: any;
  }
}

// --- VARIABILI GLOBALI (CANVAS) ---
const __app_id = "flotta-renco-v1"; // Usato come fallback
// Configurazione Firebase di esempio (verrà sovrascritta da Canvas)
const __firebase_config = `{
  "apiKey": "AIzaSyCZTaNfYTeqKaWKOnf-dqQsBFwL4pZHQfM",
  "authDomain": "gestione-flotta-pool.firebaseapp.com",
  "projectId": "gestione-flotta-pool",
  "storageBucket": "gestione-flotta-pool.firebaseapp.com",
  "messagingSenderId": "86851688702",
  "appId": "1:86851688702:web:1cff896b5909a26ada2daf"
}`;

// --- SICUREZZA ---
const PIN_UNICO = "0000"; // PIN Unico per l'accesso (MODIFICATO: 0000)

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

// Funzione helper per le collezioni (Mantenuta per l'utilizzo in onSnapshot)
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
const loadExternalScripts = (setXlsxLoaded: (loaded: boolean) => void) => {
  // Caricamento EmailJS (se necessario)
  if (!window.emailjs && EMAILJS_CONFIG.PUBLIC_KEY) {
    const script = document.createElement("script");
    script.src =
      "https://cdn.jsdelivr.net/npm/@emailjs/browser@3/dist/email.min.js";
    script.onload = () => window.emailjs.init(EMAILJS_CONFIG.PUBLIC_KEY);
    document.head.appendChild(script);
  }

  // Caricamento jsPDF
  if (!window.jspdf) {
    const script = document.createElement("script");
    script.src =
      "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
    document.head.appendChild(script);
  }

  // L'hack con estensione .xls è sempre disponibile
  setXlsxLoaded(true);
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

// Logo Renco Base (Arancio su Sfondo Chiaro - per login)
const RencoLogo = ({ className = "text-orange-600" }) => (
  <div
    className={`flex items-center font-extrabold text-2xl tracking-tight ${className}`}
  >
    {/* Usiamo un div per simulare l'effetto obliquo (skew) sul testo */}
    <div className="font-['Arial Black', sans-serif] text-3xl text-orange-600 transform skew-x-[-15deg]">
      RENCO
    </div>
  </div>
);

// LOGO STILIZZATO RENCO PER HEADER INVERSO (Bianco su Sfondo Arancio)
const RencoLogoHeader = ({ className = "" }) => (
  <div
    className={`flex items-center font-extrabold text-xl tracking-tight ${className}`}
  >
    <div className="font-['Arial Black', sans-serif] text-xl text-white transform skew-x-[-15deg] leading-none">
      RENCO
    </div>
  </div>
);

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
    // Pulsante Consegna (reso rosso per enfasi)
    primary: "bg-red-600 text-white hover:bg-red-700 shadow-red-100",
    secondary:
      "bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200",
    // Pulsante standard Admin (arancio Renco per coerenza)
    admin: "bg-orange-600 text-white hover:bg-orange-700 shadow-orange-100",
    danger: "bg-red-50 text-red-600 hover:bg-red-100",
    success: "bg-green-600 text-white hover:bg-green-700",
    outline: "border border-gray-300 text-gray-700 hover:bg-gray-50",
    // Nuovo stile per Excel: verde scuro
    excel: "bg-green-700 text-white hover:bg-green-800 shadow-green-100",
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

const SignaturePad = ({
  onSave,
  label,
  disclaimer,
  initialSignature,
  setFormData,
}: any) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [initialRenderDone, setInitialRenderDone] = useState(false);
  // Stato interno per la firma in Base64
  const [currentSignatureBase64, setCurrentSignatureBase64] = useState<
    string | null
  >(null);

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

    // Se c'è una firma base64 interna, usila. Altrimenti usa l'initialSignature (passata dall'esterno)
    const sourceSig = currentSignatureBase64 || initialSignature;

    // Ridisegna la firma
    if (sourceSig) {
      const img = new Image();
      // Impedisce la ricorsione e il loop di re-rendering/disegno.
      // Il disegno deve avvenire solo dopo che l'immagine è caricata.
      img.onload = () => {
        // Ricalcola le proporzioni se necessario
        let drawWidth = canvas.width;
        let drawHeight = canvas.height;
        ctx.drawImage(img, 0, 0, drawWidth, drawHeight);
      };
      img.src = sourceSig;
      setHasSignature(true);
    } else {
      setHasSignature(false);
    }
  }, [initialSignature, currentSignatureBase64]);

  // Gestione della Responsività (cruciale per rotazione mobile)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const setupCanvas = () => {
      // Imposta la larghezza in base al contenitore e l'altezza fissa.
      canvas.width = canvas.offsetWidth;
      canvas.height = 150;

      // Ridisegna l'ultima firma nota
      drawInitialSignature();

      if (!initialRenderDone) {
        setInitialRenderDone(true);
      }
    };

    // Timeout per assicurare che il DOM abbia calcolato l'offsetWidth corretto
    const resizeTimer = setTimeout(setupCanvas, 150);

    // Aggiungi listener per il resize (per la rotazione del dispositivo)
    window.addEventListener("resize", setupCanvas);

    return () => {
      clearTimeout(resizeTimer);
      window.removeEventListener("resize", setupCanvas);
    };
  }, [drawInitialSignature, initialRenderDone]);

  // Sincronizza lo stato interno con l'input esterno (solo all'inizio)
  useEffect(() => {
    setCurrentSignatureBase64(initialSignature);
    setHasSignature(!!initialSignature);
  }, [initialSignature]);

  const startDrawing = (e: any) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX || e.touches[0].clientX) - rect.left;
    const y = (e.clientY || e.touches[0].clientY) - rect.top;

    // *** CORREZIONE CRITICA PER PERSISTENZA TRATTO ***
    if (!isDrawing) {
      // Se c'è una firma originale (initialSignature) MA NON abbiamo ancora una currentSignatureBase64
      // (cioè è il primo tocco sul pad vuoto o con solo la vecchia firma), allora pulisci.
      if (initialSignature && !currentSignatureBase64) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        setCurrentSignatureBase64(null);
        onSave(null); // Notifica l'esterno che la vecchia firma è stata eliminata.
      }
      // Se currentSignatureBase64 esiste, NON fare nulla, semplicemente continua il tratto.
    }

    ctx.strokeStyle = "#000";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";

    ctx.beginPath();
    ctx.moveTo(x, y);

    setIsDrawing(true);
    setHasSignature(true);
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
    // Al rilascio del tocco/mouse, aggiorna lo stato interno del Base64 e lo stato esterno
    if (isDrawing) {
      setIsDrawing(false);
      const canvas = canvasRef.current;
      if (canvas) {
        const base64 = canvas.toDataURL();
        setCurrentSignatureBase64(base64);
        onSave(base64); // CHIAMIAMO ONSAVE PER AGGIORNARE LO STATO ESTERNO (FIRMA CORRENTE)
      }
    }
  };

  // Funzione per la pulizia del canvas, chiamata da 'Pulisci'
  const clear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
    setCurrentSignatureBase64(null);
    onSave(null); // Pulisce lo stato esterno

    if (setFormData) {
      // Pulisce anche la traccia di firma originale se si è in modalità Modifica Log
      setFormData((prev: any) => ({
        ...prev,
        originalSignature: null,
        currentSignature: null,
      }));
    }
  };

  // Determina quale firma mostrare nell'anteprima/stato (uso la Base64 interna)
  const displaySignature = currentSignatureBase64 || initialSignature;

  // Modalità normale (nel form)
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
          disabled={!displaySignature}
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
      {!displaySignature && (
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
          className={`w-20 h-20 flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 text-gray-500 hover:text-orange-600 hover:border-orange-300 transition-colors shrink-0 ${
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
        <div className="flex items-center gap-2">
          {type === "error" ? (
            <AlertTriangle className="w-4 h-4 text-white" />
          ) : (
            <CheckCircle className="w-4 h-4 text-white" />
          )}
        </div>
      </div>
      <div>
        <h4 className="font-bold text-sm mb-1">
          {type === "error" ? "Errore" : "Operazione Completata"}
        </h4>
        <p className="text-xs text-gray-300 leading-relaxed whitespace-pre-line mb-2">
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
  if (typeof window === "undefined" || typeof navigator === "undefined")
    return false;
  const userAgent = navigator.userAgent || navigator.vendor || window.opera;
  return /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(
    userAgent.toLowerCase()
  );
};

// --- APP PRINCIPALE ---
const App = () => {
  // --- STATO ---
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
  const [selectedLog, setSelectedLog] = useState<any>(null);
  const [modalMode, setModalMode] = useState<string | null>(null);
  const [formData, setFormData] = useState<any>({});
  const [checklist, setChecklist] = useState<any>({});
  const [photos, setPhotos] = useState<any[]>([]);
  // signature viene aggiornata solo dal salvataggio della modale fullscreen o dal pad piccolo
  const [signature, setSignature] = useState<string | null>(null);
  const [xlsxLoaded, setXlsxLoaded] = useState(true);

  // Rimosso lo stato isSignatureModalOpen

  const [toast, setToast] = useState<ToastState>({
    visible: false,
    message: "",
    type: "success",
  });

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

  // Funzione di utilità per formattare la data
  const formatDate = (isoString: string) => {
    // Usiamo toLocaleString per includere ora e data nel formato locale (per l'export)
    return new Date(isoString).toLocaleDateString("it-IT", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false, // Forze formato 24h
    });
  };

  // Funzione per formattare la data solo giorno/mese/anno
  const formatShortDate = (isoString: string) => {
    const date = new Date(isoString);
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    // PUNTO 1: Formato data PDF gg-mm-aaaa con trattino
    return `${day}-${month}-${year}`;
  };

  // --- FUNZIONI DI GENERAZIONE PDF ---

  // Funzione helper che crea il PDF come oggetto jspdf e lo restituisce (Generazione al volo)
  const generatePDFDocument = (logData: any) => {
    if (!window.jspdf) {
      console.error("Libreria PDF non caricata.");
      return null;
    }
    try {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.width;
      let yPos = 14;

      // --- LOGICA DI LAYOUT PDF ---

      // Header - Colore Renco (Orange 600)
      const RENCO_ORANGE_RGB = [234, 88, 12]; // Colore arancio

      // 1. STILE HEADER PDF: Uguale all'header dell'app (Orange 600)
      doc.setFillColor(...RENCO_ORANGE_RGB);
      doc.rect(0, 0, pageWidth, 24, "F");

      // LOGO RENCO STILIZZATO BIANCO SU ARANCIO
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(20);
      // Usiamo 'helvetica' e 'bold' come font più vicino a 'Arial Black' per coerenza
      doc.setFont("helvetica", "bold");
      // Posizioniamo la scritta RENCO (simulando il logo)
      doc.text("RENCO", 14, 16);

      // RIMOSSA LA SCRITTA "Gestione Flotta Pool" dal verbale

      yPos = 40;
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text(`VERBALE DI ${logData.type.toUpperCase()}`, 14, yPos);

      doc.setFontSize(12);
      doc.setTextColor(234, 88, 12); // Tonalità arancio Renco
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
      doc.text(`Commessa: ${logData.commessa || "N/A"}`, 100, yPos + 23);

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

          const checkText = isPresent ? "[SI]" : "[NO]";
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
            xOffset = 14;
            yPos += photoHeight + 5;
          }
          if (yPos + photoHeight > 270) {
            doc.addPage();
            yPos = 20;
            xOffset = 14;
            doc.setFontSize(10);
            doc.text(
              `FOTO ALLEGATE (Continua) - Pagina ${
                doc.internal.pages.length - 1
              }`,
              14,
              yPos
            );
            yPos += 8;
          }

          try {
            // Aggiungi immagine base64 al PDF
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
        if (yPos > 240) {
          doc.addPage();
          yPos = 20;
        }

        doc.setDrawColor(0, 0, 0);
        doc.line(14, yPos, pageWidth - 14, yPos);
        yPos += 10;

        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.setTextColor(0, 0, 0);
        doc.text("FIRMA PER ACCETTAZIONE", 14, yPos);

        try {
          // Aggiungi firma base64 al PDF
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
          "In caso di danneggiamento la societ\xe0 si riserva il diritto di addebitare il costo di riparazione al dipendente,",
          14,
          yPos
        );
        doc.text(
          "nel caso in cui il danno ammonti ad un valore superiore ai 500\u20ac, nella misura del 20% dell'importo totale.",
          14,
          yPos + 4
        );
      }

      // Restituisce l'oggetto doc di jspdf
      return doc;
    } catch (err) {
      console.error("Errore durante la creazione del PDF layout:", err);
      return null;
    }
  };

  // FUNZIONE per il download dallo storico (GENERAZIONE AL VOLO + DOWNLOAD FORZATO)
  const generatePDF = (logData: any) => {
    setGeneratingPdf(true);

    const pdfDoc = generatePDFDocument(logData);

    if (!pdfDoc) {
      setGeneratingPdf(false);
      showToast(
        "Impossibile generare il PDF. Controllare la console per i dettagli.",
        "error"
      );
      return;
    }

    const safeTripId = logData.tripId || "N/A";
    const driverName = logData.driver || "N/A";
    const datePart = formatShortDate(logData.date); // Data nel formato gg-mm-aaaa

    // NUOVA NOMENCLATURA: Verbale ID#xxxx - targa - driver - data - Consegna/Rientro.pdf
    const filename = `Verbale ID#${safeTripId} - ${logData.plate} - ${driverName} - ${datePart} - ${logData.type}.pdf`;

    try {
      // Usa doc.output('blob') per ottenere i dati binari
      const pdfBlob = pdfDoc.output("blob");
      const url = URL.createObjectURL(pdfBlob);

      // Crea un link invisibile e forza il download
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url); // Rilascia la risorsa

      showToast(
        `Download avviato: '${filename}'. Apri il file dalla cartella Download.`,
        "success"
      );
    } catch (e) {
      console.error("Errore nel salvataggio/download del PDF (doc.output):", e);
      showToast(
        "Errore grave: Impossibile avviare il download del PDF.",
        "error"
      );
    } finally {
      setGeneratingPdf(false);
    }
  };

  // --- FUNZIONI DI GESTIONE MODALI ---
  const openModal = (mode: string, vehicle: any = null) => {
    // Solo Admin può aggiungere/modificare
    if ((mode === "add" || mode === "edit") && authRole !== "admin") {
      showToast(
        "Accesso negato: solo gli amministratori possono modificare la flotta.",
        "error"
      );
      return;
    }
    setModalMode(mode);
    setSelectedVehicle(vehicle);
    setSelectedLog(null); // Resetta log selezionato
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
        currentSignature: null, // Firma corrente
      });
    } else {
      setFormData({
        imageUrl: "", // Inizializza l'immagine Base64
        currentSignature: null,
      });
    }
  };

  const openLogModal = (log: any) => {
    setModalMode("editLog");
    setSelectedLog(log);
    setSelectedVehicle(null);
    // PULISCI FIRMA: setSignature a null per forzare una nuova firma (PUNTO 3)
    setSignature(null);
    setChecklist(log.checklist || {});
    setPhotos(log.photos || []);

    setFormData({
      km: log.km,
      fuel: log.fuel,
      notes: log.notes || "",
      damages: log.damages || "",
      // Passiamo la firma originale per il rendering
      originalSignature: log.signature || null,
      currentSignature: null, // Firma per la modifica
    });
  };

  const closeModal = () => {
    setModalMode(null);
    setSelectedVehicle(null);
    setSelectedLog(null);
    setFormData({});
  };

  // Funzione per salvare la firma dalla modale a schermo intero (RIMOSSA LOGICA FULLSCREEN)
  const handleSignatureSave = (base64Signature: string | null) => {
    setSignature(base64Signature);
    setFormData((prev: any) => ({
      ...prev,
      currentSignature: base64Signature,
      // Se stiamo modificando, puliamo l'originale quando l'utente salva la nuova
      originalSignature:
        modalMode === "editLog" && base64Signature
          ? null
          : prev.originalSignature,
    }));
  };

  // --- FUNZIONI DI GESTIONE (HANDLE...) ---

  // FUNZIONE: Login (Punto 1)
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

  // FUNZIONE: Aggiungi Veicolo (Ripristinata con la tua sintassi)
  const handleAddVehicle = async (e: any) => {
    e.preventDefault();
    if (authRole !== "admin" || !db) return;
    try {
      await addDoc(
        collection(db, "artifacts", appId, "public", "data", "vehicles"),
        {
          model: formData.model,
          plate: formData.plate.toUpperCase(),
          km: parseInt(formData.km),
          imageUrl: formData.imageUrl || null, // Immagine Base64
          status: "disponibile",
          fuel: "Pieno",
          driver: null,
          currentTripId: null,
          commessa: null,
        }
      );
      closeModal();
      showToast("Veicolo aggiunto.", "success");
    } catch (err) {
      console.error(err);
      showToast("Errore salvataggio.", "error");
    }
  };

  // FUNZIONE: Modifica Veicolo (Ripristinata con la tua sintassi)
  const handleEditVehicle = async (e: any) => {
    e.preventDefault();
    if (authRole !== "admin" || !db || !selectedVehicle) return;
    try {
      const vehicleRef = doc(
        db,
        "artifacts",
        appId,
        "public",
        "data",
        "vehicles",
        selectedVehicle.id
      );
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

  // FUNZIONE: Elimina Veicolo (Ripristinata con ConfirmationModal)
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
          await deleteDoc(
            doc(db, "artifacts", appId, "public", "data", "vehicles", id)
          );
          showToast("Veicolo eliminato.", "success");
        } catch (err) {
          showToast("Errore eliminazione.", "error");
        }
      },
      onCancel: () => setConfirmModal({ isOpen: false }),
    });
  };

  // FUNZIONE: Modifica Log (Storico)
  const handleEditLog = async (e: any) => {
    e.preventDefault();
    if (!db || !selectedLog) return;

    // La nuova firma è obbligatoria per la modifica (signature è stato resettato a null in openLogModal)
    // Usiamo `signature` che è aggiornato da handleSignatureSave
    if (!signature && !selectedLog.signature) {
      // Se non ho nuova firma e non avevo quella vecchia
      showToast(
        "Una firma è obbligatoria per confermare la modifica del report.",
        "error"
      );
      return;
    }

    const logRef = getPublicDocRef("logs", selectedLog.id);

    try {
      // 1. Aggiorna i dati del log
      await updateDoc(logRef, {
        km: parseInt(formData.km) || selectedLog.km,
        fuel: formData.fuel,
        notes: formData.notes || "",
        damages: formData.damages || "",
        checklist: checklist,
        signature: signature || selectedLog.signature, // Usa la nuova firma o quella precedente
        photos: photos,
        lastModified: new Date().toISOString(),
      });

      // 2. Trova il veicolo e aggiorna il suo stato KM/Fuel
      const vehicle = vehicles.find((v) => v.id === selectedLog.vehicleId);
      if (vehicle) {
        const vehicleRef = getPublicDocRef("vehicles", vehicle.id);
        // Aggiorna solo i campi km e fuel, in base all'ultimo log salvato
        await updateDoc(vehicleRef, {
          km: parseInt(formData.km) || vehicle.km,
          fuel: formData.fuel,
        });
      }

      closeModal();
      showToast(
        `Log #${selectedLog.tripId} modificato con successo.`,
        "success"
      );
    } catch (err) {
      console.error(err);
      showToast("Errore durante la modifica del log.", "error");
    }
  };

  // FUNZIONE: Elimina Log (Storico) - IMPLEMENTATA per il punto 2
  const deleteLog = async (logId: string) => {
    if (authRole !== "admin" || !db) {
      showToast(
        "Accesso negato: solo gli amministratori possono eliminare i report.",
        "error"
      );
      return;
    }

    setConfirmModal({
      isOpen: true,
      title: "Conferma Eliminazione Report",
      message:
        "Sei sicuro di voler eliminare permanentemente questo report di movimento? L'eliminazione è irreversibile.",
      onConfirm: async () => {
        setConfirmModal({ isOpen: false });
        try {
          await deleteDoc(getPublicDocRef("logs", logId));
          showToast("Report di movimento eliminato.", "success");
        } catch (err) {
          showToast("Errore eliminazione report.", "error");
        }
      },
      onCancel: () => setConfirmModal({ isOpen: false }),
    });
  };

  // FUNZIONE: Transazione Check-in / Check-out (SALVA LOG SU DB)
  const handleTransaction = async (e: any) => {
    e.preventDefault();
    if (!signature || !db) {
      showToast("Firma obbligatoria.", "error");
      return;
    }

    const type = modalMode === "checkout" ? "Consegna" : "Rientro"; // NOME AGGIORNATO
    const newStatus = modalMode === "checkout" ? "impegnato" : "disponibile";

    if (modalMode === "checkin" && parseInt(formData.km) < selectedVehicle.km) {
      showToast(
        `I Km inseriti (${formData.km}) devono essere maggiori o uguali a quelli di Ritiro (${selectedVehicle.km}).`,
        "error"
      );
      return;
    }

    try {
      let tripId = selectedVehicle.currentTripId || null;

      if (modalMode === "checkout") {
        // Genera il nuovo ID solo al Ritiro
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

      // Aggiorna il veicolo
      const vehicleRef = doc(
        db,
        "artifacts",
        appId,
        "public",
        "data",
        "vehicles",
        selectedVehicle.id
      );
      await updateDoc(vehicleRef, {
        status: newStatus,
        driver: modalMode === "checkout" ? formData.driver : null,
        km: parseInt(formData.km) || selectedVehicle.km,
        fuel: formData.fuel,
        currentTripId: modalMode === "checkout" ? tripId : null,
        commessa: modalMode === "checkout" ? formData.commessa : null,
      });

      // Aggiunge il log
      await addDoc(
        collection(db, "artifacts", appId, "public", "data", "logs"),
        logData
      );

      closeModal();

      // CHIAMATA PER SCARICARE IL PDF SUBITO DOPO IL SALVATAGGIO (Punto 1)
      showToast(
        `${type} completata con successo! Download del Verbale in corso...`,
        "success"
      );
      generatePDF(logData);
    } catch (err) {
      console.error(err);
      showToast(
        "Errore salvataggio su Cloud. La transazione non è riuscita.",
        "error"
      );
    }
  };

  // FUNZIONE: Export Excel (Trip su riga singola)
  const exportToExcelHack = (logsData: any[], filename: string) => {
    if (logsData.length === 0) {
      showToast("Nessun dato da esportare.", "error");
      return;
    }

    // Aggregazione in un unico oggetto per Trip ID
    const trips: any = {};
    logsData.forEach((log: any) => {
      const tid = log.tripId || "LEGACY";
      if (!trips[tid]) {
        trips[tid] = {
          tripId: log.tripId,
          vehicleModel: log.vehicleModel,
          plate: log.plate,
          commessa: log.commessa || "N/A",
        };
      }

      // Consegna (checkout) / Rientro (checkin)
      const isConsegna = log.type === "Consegna";
      const suffix = isConsegna ? "CONSEGNA" : "RIENTRO";

      // Aggiungi i dati del movimento
      trips[tid][`Data ${suffix}`] = formatDate(log.date);
      trips[tid][`Driver ${suffix}`] = log.driver || "N/A";
      trips[tid][`Km ${suffix}`] = log.km;
      trips[tid][`Fuel ${suffix}`] = log.fuel;
      trips[tid][`Danni ${suffix}`] = log.damages || "";
      trips[tid][`Note ${suffix}`] = log.notes || "";

      // La checklist è sempre la più recente (dal Rientro) o l'ultima registrazione
      CHECKLIST_ITEMS.forEach((item) => {
        // Usiamo la checklist del log più recente nel trip per la colonna finale
        if (!trips[tid][item.label] || !isConsegna) {
          trips[tid][item.label] = log.checklist?.[item.id] ? "SI" : "NO";
        }
      });
    });

    const aggregatedTrips = Object.values(trips);

    if (aggregatedTrips.length === 0) {
      showToast("Nessun dato aggregato da esportare.", "error");
      return;
    }

    // Separatore: Punto e Virgola (;) per compatibilità EU Excel
    const SEPARATOR = ";";

    // Intestazioni per il formato Trip Unico
    const headers = [
      "Trip ID",
      "Modello Veicolo",
      "Targa",
      "Commessa",
      "Data CONSEGNA",
      "Driver CONSEGNA",
      "Km CONSEGNA",
      "Fuel CONSEGNA",
      "Danni CONSEGNA",
      "Note CONSEGNA",
      "Data RIENTRO",
      "Driver RIENTRO",
      "Km RIENTRO",
      "Fuel RIENTRO",
      "Danni RIENTRO",
      "Note RIENTRO",
      ...CHECKLIST_ITEMS.map((item) => `Dotazione ${item.label}`),
    ];

    const csvRows = aggregatedTrips.map((trip: any) => {
      // Funzione per pulire e avvolgere un campo di testo nelle virgolette (necessario per CSV/XLS)
      const cleanAndQuote = (text: string | number | undefined) => {
        if (text === null || text === undefined) return "";
        let str = String(text).replace(/"/g, '""'); // Escapa le virgolette doppie
        str = str.replace(/(\r\n|\n|\r)/gm, " "); // Rimuove newlines

        // In Excel, avvolgere tutto tra virgolette doppie risolve molti problemi di formattazione
        return `"${str}"`;
      };

      // Funzione che gestisce i dati che potrebbero essere interpretati male (Km, Frazioni)
      const cleanExcelValue = (value: any) => {
        if (value === undefined || value === null) return "";
        let str = String(value);

        // Se il valore è una frazione o un numero, aggiungi uno spazio iniziale per forzare la formattazione testuale
        // ESEMPIO: " 1/4" -> Excel lo tratta come testo.
        if (str.includes("/") || (/^\d+$/.test(str) && str.length > 1)) {
          str = ` ${str}`;
        }

        // Ritorna la stringa pulita
        return cleanAndQuote(str);
      };

      const checklistValues = CHECKLIST_ITEMS.map(
        (item) => trip[item.label] || "N/A"
      );

      return [
        cleanAndQuote(`#${trip.tripId || "N/A"}`),
        cleanAndQuote(trip.vehicleModel),
        cleanAndQuote(trip.plate),
        cleanAndQuote(trip.commessa),

        cleanAndQuote(trip["Data CONSEGNA"] || ""),
        cleanAndQuote(trip["Driver CONSEGNA"] || ""),
        cleanExcelValue(trip["Km CONSEGNA"] || ""),
        cleanExcelValue(trip["Fuel CONSEGNA"] || ""),
        cleanAndQuote(trip["Danni CONSEGNA"] || ""),
        cleanAndQuote(trip["Note CONSEGNA"] || ""),

        cleanAndQuote(trip["Data RIENTRO"] || ""),
        cleanAndQuote(trip["Driver RIENTRO"] || ""),
        cleanExcelValue(trip["Km RIENTRO"] || ""),
        cleanExcelValue(trip["Fuel RIENTRO"] || ""),
        cleanAndQuote(trip["Danni RIENTRO"] || ""),
        cleanAndQuote(trip["Note RIENTRO"] || ""),

        ...checklistValues.map((val) => cleanAndQuote(val)),
      ].join(SEPARATOR);
    });

    // Inserisce il Byte Order Mark (BOM) per garantire la corretta interpretazione di UTF-8 in Excel
    const csvContent = [headers.join(SEPARATOR), ...csvRows].join("\n");

    // Crea un BLOB con codifica UTF-8 e MIME type per EXCEL (compatibile XLS)
    const blob = new Blob(["\ufeff", csvContent], {
      type: "application/vnd.ms-excel;charset=utf-8;", // MIME type per XLS (compatibile XLS)
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.setAttribute("href", url);
    // Assicura l'estensione .xls
    link.setAttribute("download", filename.replace(".xls", ".xls"));

    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    // Messaggio di successo amichevole
    showToast(
      "Report Export Completato! Il file XLS è pronto nella cartella Download.",
      "success"
    );
  };

  // --- RENDERING COMPONENTI MODALI E SELETTORI ---

  const renderFuelSelector = () => (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        Livello Carburante Attuale
      </label>
      <div className="flex gap-2 p-2 bg-gray-50 rounded-lg border">
        {FUEL_LEVELS.map((level) => (
          <button
            key={level}
            type="button"
            onClick={() => setFormData({ ...formData, fuel: level })}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all border ${
              formData.fuel === level
                ? "bg-orange-600 text-white border-orange-700 shadow-md"
                : "bg-white text-gray-700 hover:bg-gray-100 border-gray-200"
            }`}
          >
            {level}
          </button>
        ))}
      </div>
    </div>
  );

  const renderChecklist = () => (
    <div>
      <h4 className="text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
        <FileText className="w-4 h-4" /> Dotazioni (Checklist)
      </h4>
      <div className="grid grid-cols-2 gap-3 bg-gray-50 p-4 rounded-xl border">
        {CHECKLIST_ITEMS.map((item) => (
          <div key={item.id} className="flex items-center">
            <input
              id={item.id}
              type="checkbox"
              checked={!!checklist[item.id]}
              onChange={(e) =>
                setChecklist({
                  ...checklist,
                  [item.id]: e.target.checked,
                })
              }
              className="h-4 w-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
            />
            <label
              htmlFor={item.id}
              className="ml-2 block text-sm font-medium text-gray-700 select-none"
            >
              {item.label}
            </label>
          </div>
        ))}
      </div>
    </div>
  );

  // RIMOSSA LA FUNZIONE renderFullScreenSignatureModal

  const renderModal = () => {
    if (!modalMode || modalMode === "editLog") return null; // Non renderizza qui se è editLog
    const isConsegna = modalMode === "checkout";
    const isEdit = modalMode === "edit";
    const isAdd = modalMode === "add";

    // Nomi movimenti nel titolo della modale
    const movementName = isConsegna ? "Consegna" : "Rientro";

    // Determina la firma da mostrare nel piccolo box di anteprima
    const currentSignature =
      signature || (modalMode === "editLog" ? selectedLog?.signature : null);

    return (
      <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm">
        <div className="flex min-h-full items-center justify-center p-4 text-center">
          {/* MODIFICATO: rimosso il max-w su tutti i breakpoint per permettere l'espansione massima sul mobile */}
          <Card className="w-full sm:max-w-full md:max-w-xl transform text-left align-middle transition-all overflow-y-auto max-h-[90vh]">
            <div className="p-6">
              <div className="flex justify-between items-start border-b pb-4 mb-4 sticky top-0 bg-white z-10">
                <h3 className="text-xl font-extrabold text-gray-900 flex items-center gap-3">
                  {isAdd && <Plus className="w-5 h-5 text-orange-600" />}
                  {isEdit && <Pencil className="w-5 h-5 text-blue-600" />}
                  {/* Il pulsante Consegna è stato spostato sul rosso, quindi l'icona qui è coerente */}
                  {isConsegna && (
                    <ArrowRight className="w-5 h-5 text-red-600" />
                  )}
                  {!isConsegna && !isAdd && !isEdit && (
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  )}

                  {isAdd
                    ? "Nuovo Mezzo"
                    : isEdit
                    ? `Modifica Veicolo: ${selectedVehicle?.model}`
                    : `${movementName}: ${selectedVehicle?.model}`}
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
                    setImageUrl={(url: string) =>
                      setFormData({ ...formData, imageUrl: url })
                    }
                    onShowToast={showToast}
                  />

                  <div className="flex gap-3 pt-2">
                    <Button
                      variant="secondary"
                      onClick={closeModal}
                      className="w-auto"
                    >
                      Annulla
                    </Button>
                    <Button variant="admin" type="submit" className="w-auto">
                      {isAdd ? "Salva Mezzo" : "Aggiorna Dati"}
                    </Button>
                  </div>
                </form>
              ) : (
                // MODULO MOVIMENTI (Consegna / Rientro)
                <form onSubmit={handleTransaction} className="space-y-4">
                  {/* Riepilogo Dati Uscita (solo Rientro) */}
                  {!isConsegna && selectedVehicle && (
                    <div className="grid grid-cols-2 gap-4 bg-orange-50 p-4 rounded-xl border border-orange-200">
                      <div>
                        <span className="text-xs text-orange-700 uppercase font-bold">
                          Driver Consegna
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
                          Km Consegna
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
                    {isConsegna && (
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
                      {!isConsegna &&
                        parseInt(formData.km) < selectedVehicle?.km && (
                          <p className="text-xs text-red-500 mt-1">
                            Attenzione: Km inferiori a quelli di Consegna.
                          </p>
                        )}
                    </div>
                  </div>

                  {/* Commessa (solo Consegna) */}
                  {isConsegna && (
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
                      {isConsegna
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
                        isConsegna
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
                  <PhotoUpload
                    photos={photos}
                    setPhotos={setPhotos}
                    onShowToast={showToast}
                  />

                  {/* SEZIONE FIRMA STANDARD (Modale unica) */}
                  <div className="md:col-span-full">
                    <SignaturePad
                      onSave={handleSignatureSave}
                      label="Firma Driver per Accettazione"
                      setFormData={setFormData}
                      initialSignature={signature || selectedVehicle?.signature}
                      disclaimer={
                        isConsegna
                          ? "In caso di danneggiamento la società si riserva il diritto di addebitare il costo di riparazione al dipendente, nel caso in cui il danno ammonti ad un valore superiore ai 500€, nella misura del 20% dell'importo totale."
                          : null
                      }
                    />
                  </div>

                  <div className="flex gap-3 pt-4 sticky bottom-0 bg-white border-t pt-4">
                    <Button
                      variant="secondary"
                      onClick={closeModal}
                      className="w-auto"
                    >
                      Annulla
                    </Button>
                    {/* Testo aggiornato in Consegna/Rientro */}
                    <Button
                      type="submit"
                      loading={generatingPdf}
                      disabled={generatingPdf || !signature}
                      className="w-auto"
                    >
                      {isConsegna
                        ? "Conferma Consegna e Salva"
                        : "Conferma Rientro e Salva"}
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

  const renderLogModal = () => {
    if (modalMode !== "editLog" || !selectedLog) return null; // Non renderizza qui se è editLog

    // Determina la firma da mostrare nel piccolo box di anteprima (priorità alla nuova firma, poi all'originale)
    const currentSignature = signature || selectedLog.signature;

    // ... Logica di rendering Modifica Log
    return (
      <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm">
        <div className="flex min-h-full items-center justify-center p-4 text-center">
          {/* Rimosso max-w per l'espansione della firma */}
          <Card className="w-full sm:max-w-full md:max-w-xl transform text-left align-middle transition-all overflow-y-auto max-h-[90vh]">
            <div className="p-6">
              <div className="flex justify-between items-start border-b pb-4 mb-4 sticky top-0 bg-white z-10">
                <h3 className="text-xl font-extrabold text-gray-900 flex items-center gap-3">
                  <Pencil className="w-5 h-5 text-purple-600" />
                  Modifica Log #{selectedLog.tripId} ({selectedLog.type})
                </h3>
                <button
                  type="button"
                  onClick={closeModal}
                  className="p-1 rounded-full hover:bg-gray-100 text-gray-500 hover:text-gray-900"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleEditLog} className="space-y-4">
                <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-xl border border-gray-200 text-sm">
                  <div>
                    <span className="text-xs text-gray-500 uppercase font-bold">
                      Veicolo
                    </span>
                    <br />
                    <strong className="text-gray-900">
                      {selectedLog.vehicleModel}
                    </strong>
                    <p className="text-xs text-gray-600">{selectedLog.plate}</p>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500 uppercase font-bold">
                      Driver Originale
                    </span>
                    <br />
                    <strong className="text-gray-900">
                      {selectedLog.driver}
                    </strong>
                    <p className="text-xs text-gray-600">
                      {formatDate(selectedLog.date)}
                    </p>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Km Attuali (Revisione)
                  </label>
                  <input
                    type="number"
                    className="w-full border p-3 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                    value={formData.km || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, km: e.target.value })
                    }
                    required
                    min={selectedLog.km} // Usa il km del log originale come minimo
                  />
                </div>
                {renderFuelSelector()}
                {renderChecklist()}

                <div className="bg-red-50 p-3 rounded-lg border border-red-100">
                  <label className="text-sm font-bold text-red-700 flex items-center gap-1 mb-2">
                    <AlertTriangle className="w-4 h-4" /> Danni / Anomalie
                    (Revisione)
                  </label>
                  <textarea
                    className="w-full p-2 border border-red-200 rounded-lg bg-white text-sm focus:ring-2 focus:ring-red-500 outline-none"
                    rows={2}
                    value={formData.damages || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, damages: e.target.value })
                    }
                    placeholder="Descrivi eventuali correzioni o anomalie..."
                  ></textarea>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Note Generali (Revisione)
                  </label>
                  <textarea
                    className="w-full p-3 border rounded-lg text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                    rows={1}
                    value={formData.notes || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, notes: e.target.value })
                    }
                    placeholder="Note aggiuntive per la revisione..."
                  ></textarea>
                </div>

                <PhotoUpload
                  photos={photos}
                  setPhotos={setPhotos}
                  onShowToast={showToast}
                />

                {/* SEZIONE FIRMA STANDARD (Modale unica) */}
                <div className="md:col-span-full">
                  <SignaturePad
                    onSave={handleSignatureSave}
                    label="Firma di Revisione/Conferma"
                    setFormData={setFormData}
                    initialSignature={signature || selectedLog?.signature}
                    disclaimer="Per salvare le modifiche è necessario fornire una NUOVA firma."
                  />
                </div>

                <div className="flex gap-3 pt-4 sticky bottom-0 bg-white border-t pt-4">
                  <Button
                    variant="secondary"
                    onClick={closeModal}
                    className="w-auto"
                  >
                    Annulla
                  </Button>
                  {/* Il pulsante di salvataggio è disabilitato se non c'è una nuova firma, ma non blocca se si sta solo visualizzando la vecchia */}
                  <Button
                    type="submit"
                    className="w-auto"
                    disabled={!signature && !selectedLog.signature}
                  >
                    Salva Revisione
                  </Button>
                </div>
              </form>
            </div>
          </Card>
        </div>
      </div>
    );
  };

  const renderLogin = () => (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-4">
      <Card className="max-w-sm w-full p-6 text-center">
        {/* LOGO RENCO COMPLETO NEL LOGIN (Centrato) */}
        <div className="mx-auto mb-6 w-fit">
          <RencoLogo />
        </div>
        <h2 className="text-2xl font-bold mb-2 text-gray-900">Login</h2>
        <p className="text-sm text-gray-500 mb-6">
          Inserisci il PIN per accedere alle funzioni di gestione.
        </p>
        <form onSubmit={handleLogin} className="space-y-4">
          <input
            type="password"
            placeholder="PIN"
            value={pinInput}
            onChange={(e) => setPinInput(e.target.value)}
            className="w-full border p-3 rounded-lg text-center tracking-[0.5em] font-mono text-lg focus:ring-2 focus:ring-orange-500 outline-none"
            maxLength={PIN_UNICO.length}
            required
          />
          <Button variant="admin" type="submit" className="w-full">
            <LogIn className="w-5 h-5" /> Accedi
          </Button>
        </form>
      </Card>
    </div>
  );

  const renderDashboard = () => {
    const filteredVehicles = vehicles.filter(
      (v) =>
        v.model.toLowerCase().includes(searchDashboardTerm.toLowerCase()) ||
        v.plate.toLowerCase().includes(searchDashboardTerm.toLowerCase()) ||
        v.driver?.toLowerCase().includes(searchDashboardTerm.toLowerCase())
    );

    const available = vehicles.filter((v) => v.status === "disponibile");
    const engaged = vehicles.filter((v) => v.status === "impegnato");
    const totalVehicles = vehicles.length; // Calcolo Totale Veicoli

    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-extrabold text-gray-700">
          Dashboard Flotta
        </h2>

        {/* Rimosso il contatore Manutenzione -> Griglia a 3 colonne */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <Card className="p-4 flex items-center gap-4 bg-gray-100">
            <div className="bg-slate-700 p-3 rounded-full text-white">
              <Car className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Totale Veicoli</p>
              <strong className="text-3xl font-bold">{totalVehicles}</strong>
            </div>
          </Card>
          <Card className="p-4 flex items-center gap-4 bg-green-50">
            <div className="bg-green-600 p-3 rounded-full text-white">
              <CheckCircle className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Disponibili</p>
              <strong className="text-3xl font-bold">{available.length}</strong>
            </div>
          </Card>
          {/* ICONA ROSSA per In Uso (Punto 4) */}
          <Card className="p-4 flex items-center gap-4 bg-red-50">
            <div className="bg-red-600 p-3 rounded-full text-white">
              <ArrowRight className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-gray-600">In Uso</p>
              <strong className="text-3xl font-bold">{engaged.length}</strong>
            </div>
          </Card>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Cerca veicolo, targa o driver..."
              value={searchDashboardTerm}
              onChange={(e) => setSearchDashboardTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-orange-500 focus:border-orange-500"
            />
          </div>
        </div>

        {loadingData ? (
          <div className="text-center py-12 text-gray-500">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
            Caricamento dati...
          </div>
        ) : filteredVehicles.length === 0 ? (
          <div className="text-center py-12 text-gray-500 bg-white rounded-xl shadow-sm border border-gray-100">
            <AlertCircle className="w-10 h-10 mx-auto mb-3 text-gray-400" />
            <p>Nessun veicolo trovato corrispondente alla ricerca.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredVehicles.map((v) => (
              <Card
                key={v.id}
                className="p-4 flex items-start gap-4 hover:shadow-md transition-shadow"
              >
                {/* Immagine veicolo o placeholder */}
                <div className="w-16 h-16 rounded-lg overflow-hidden shrink-0">
                  {v.imageUrl ? (
                    <img
                      src={v.imageUrl}
                      alt={v.model}
                      className="w-full h-full object-cover border border-gray-200"
                      onError={(e) => {
                        // Fallback se l'immagine base64 è corrotta
                        const target = e.target as HTMLImageElement;
                        target.onerror = null;
                        target.src = `https://placehold.co/64x64/f97316/ffffff?text=${v.plate}`;
                        target.style.objectFit = "contain";
                      }}
                    />
                  ) : (
                    <div className="w-full h-full bg-orange-100 flex items-center justify-center text-orange-600 text-xs font-bold border border-gray-200">
                      {v.plate || "NO IMG"}
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start mb-1">
                    <h3 className="text-lg font-bold truncate text-gray-900">
                      {v.model}
                    </h3>
                    <Badge status={v.status} />
                  </div>
                  <p className="text-sm text-gray-600 font-mono mb-2">
                    {v.plate}
                  </p>

                  {/* Info Aggiuntive e Bottone */}
                  <div className="mt-2 text-xs text-gray-500 space-y-1">
                    <p>
                      <strong>Km:</strong> {v.km} |<strong> Fuel:</strong>{" "}
                      {v.fuel}
                    </p>
                    {v.status === "impegnato" && (
                      <p className="text-orange-700">
                        <User className="inline w-3 h-3 mr-1" />
                        <strong>Driver:</strong> {v.driver || "N/A"} (Commessa:{" "}
                        {v.commessa || "N/A"})
                      </p>
                    )}
                  </div>

                  <div className="mt-4 flex gap-3">
                    {/* Testo bottoni in Consegna/Rientro */}
                    {v.status === "disponibile" ? (
                      <Button
                        variant="primary" // Ora in rosso
                        className="text-sm py-2 px-3 flex-1 sm:flex-none"
                        onClick={() => openModal("checkout", v)}
                      >
                        <ArrowRight className="w-4 h-4" /> Consegna
                      </Button>
                    ) : v.status === "impegnato" ? (
                      <Button
                        variant="success"
                        className="text-sm py-2 px-3 flex-1 sm:flex-none"
                        onClick={() => openModal("checkin", v)}
                      >
                        <CheckCircle className="w-4 h-4" /> Rientro
                      </Button>
                    ) : (
                      <Button
                        variant="danger"
                        className="text-sm py-2 px-3 flex-1 sm:flex-none"
                        disabled
                      >
                        <Zap className="w-4 h-4" /> In Manutenzione
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderFleet = () => {
    const filteredVehicles = vehicles.filter(
      (v) =>
        v.model.toLowerCase().includes(searchFleetTerm.toLowerCase()) ||
        v.plate.toLowerCase().includes(searchFleetTerm.toLowerCase())
    );

    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-extrabold text-gray-700">
          Gestione Flotta
        </h2>

        <div className="flex flex-col sm:flex-row gap-3 items-stretch">
          <Button
            variant="admin"
            onClick={() => openModal("add")}
            className="sm:w-1/3"
          >
            <Plus className="w-5 h-5" /> Aggiungi Nuovo Veicolo
          </Button>
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Filtra per Modello o Targa..."
              value={searchFleetTerm}
              onChange={(e) => setSearchFleetTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-orange-500 focus:border-orange-500"
            />
          </div>
        </div>

        <Card>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Veicolo
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Targa
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden sm:table-cell">
                    Km
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">
                    Driver
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Stato
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Azioni
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredVehicles.map((v) => (
                  <tr key={v.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      <div className="flex items-center gap-3">
                        {v.imageUrl && (
                          <img
                            src={v.imageUrl}
                            alt={v.model}
                            className="w-8 h-8 object-cover rounded-full"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.onerror = null;
                              target.src =
                                "https://placehold.co/32x32/f97316/ffffff?text=C";
                            }}
                          />
                        )}
                        {!v.imageUrl && (
                          <Car className="w-5 h-5 text-gray-400" />
                        )}
                        {v.model}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">
                      {v.plate}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 hidden sm:table-cell">
                      {v.km}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 hidden md:table-cell">
                      {v.driver || "N/A"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <Badge status={v.status} />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => openModal("edit", v)}
                          className="text-blue-600 hover:text-blue-900 p-2 rounded-full hover:bg-blue-50 transition-colors"
                          title="Modifica"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => deleteVehicle(v.id)}
                          className="text-red-600 hover:text-red-900 p-2 rounded-full hover:bg-red-50 transition-colors"
                          title="Elimina"
                          disabled={v.status !== "disponibile"} // Disabilita se in uso
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filteredVehicles.length === 0 && !loadingData && (
            <div className="text-center p-6 text-gray-500">
              Nessun veicolo registrato.
            </div>
          )}
        </Card>
        {loadingData && (
          <div className="text-center py-4 text-gray-500">
            <Loader2 className="w-6 h-6 animate-spin mx-auto" />
          </div>
        )}
      </div>
    );
  };

  const renderHistory = () => {
    // 1. Filtra i log in base al termine di ricerca
    const filteredLogs = logs.filter(
      (log) =>
        (log.model?.toLowerCase() || "").includes(searchTerm.toLowerCase()) || // FIX: Aggiunto controllo di null
        (log.plate?.toLowerCase() || "").includes(searchTerm.toLowerCase()) || // FIX: Aggiunto controllo di null
        (log.driver?.toLowerCase() || "").includes(searchTerm.toLowerCase()) ||
        (log.tripId || "").includes(searchTerm)
    );

    // 2. Raggruppa i log per Trip ID
    const groupedLogs = filteredLogs.reduce(
      (acc: { [key: string]: any[] }, log: any) => {
        const tid = log.tripId || "LEGACY";
        if (!acc[tid]) {
          acc[tid] = [];
        }
        acc[tid].push(log);
        return acc;
      },
      {}
    );

    // 3. Formatta per la visualizzazione (Array di Trip completi/in corso)
    const displayTrips = Object.keys(groupedLogs)
      .sort((a, b) => {
        // Ordina per la data del log più recente (il primo nel gruppo)
        const dateA = new Date(groupedLogs[a][0].date).getTime();
        const dateB = new Date(groupedLogs[b][0].date).getTime();
        return dateB - dateA; // Ordine: Gruppo più recente per primo
      })
      .map((tripId) => {
        // FIX: Aggiunta tipizzazione esplicita a 'a', 'b', 'l' per risolvere errori TS7006.
        const logsInTrip = groupedLogs[tripId].sort(
          (a: any, b: any) =>
            new Date(a.date).getTime() - new Date(b.date).getTime()
        );

        const consegna = logsInTrip.find((l: any) => l.type === "Consegna");
        const rientro = logsInTrip.find((l: any) => l.type === "Rientro");

        // Log per i dettagli base (prendiamo l'ultimo log come riferimento se non c'è rientro, altrimenti la consegna)
        const refLog = rientro || consegna || logsInTrip[0];
        const kmPercorsi =
          rientro && consegna ? rientro.km - consegna.km : "N/A";

        return {
          tripId: tripId,
          vehicleModel: refLog.vehicleModel,
          plate: refLog.plate,
          commessa: refLog.commessa || "N/A",
          consegna: consegna,
          rientro: rientro,
          kmPercorsi: kmPercorsi,
        };
      });

    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-extrabold text-gray-700">
          Storico Movimenti
        </h2>

        <div className="flex flex-col sm:flex-row gap-3 items-stretch">
          {/* PULSANTE EXCEL */}
          <Button
            variant="excel"
            onClick={() =>
              exportToExcelHack(
                logs,
                `Storico_Renco_Flotta_${new Date()
                  .toISOString()
                  .slice(0, 10)}.xls`
              )
            }
            className="flex-shrink-0 sm:w-1/3"
          >
            <FileDown className="w-5 h-5" /> Excel
          </Button>
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Cerca per Targa, Driver, Trip ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-orange-500 focus:border-orange-500"
            />
          </div>
        </div>

        {loadingData ? (
          <div className="text-center py-12 text-gray-500">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
            Caricamento dati...
          </div>
        ) : displayTrips.length === 0 ? (
          <div className="text-center py-12 text-gray-500 bg-white rounded-xl shadow-sm border border-gray-100">
            <AlertCircle className="w-10 h-10 mx-auto mb-3 text-gray-400" />
            <p>Nessun trip trovato corrispondente alla ricerca.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Visualizzazione raggruppata per Trip ID (Consegna/Rientro) */}
            {displayTrips.map((trip) => (
              <Card
                key={trip.tripId}
                className="p-4 hover:shadow-lg transition-shadow"
              >
                <div className="flex justify-between items-start border-b pb-3 mb-3">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">
                      Trip ID: #{trip.tripId}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {trip.vehicleModel} ({trip.plate})
                    </p>
                  </div>
                  {trip.rientro && (
                    <span className="text-sm font-semibold text-green-700 bg-green-100 px-3 py-1 rounded-full">
                      Completato
                    </span>
                  )}
                  {!trip.rientro && trip.consegna && (
                    <span className="text-sm font-semibold text-orange-700 bg-orange-100 px-3 py-1 rounded-full">
                      In Corso
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* RICONSEGNA (RIENTRO) - PRIMO */}
                  {trip.rientro ? (
                    <div className="p-3 border rounded-lg bg-green-50/50">
                      <h4 className="flex items-center gap-2 text-base font-semibold text-green-700 mb-2">
                        <CheckCircle className="w-4 h-4" /> Rientro
                      </h4>
                      <p className="text-sm text-gray-700">
                        <strong>Driver:</strong> {trip.rientro.driver}
                      </p>
                      <p className="text-sm text-gray-700">
                        <strong>Data:</strong> {formatDate(trip.rientro.date)}
                      </p>
                      <p className="text-sm text-gray-700">
                        <strong>Km Finali:</strong> {trip.rientro.km} |
                        <strong> Fuel:</strong> {trip.rientro.fuel}
                      </p>
                      <p className="text-sm text-orange-700 font-medium mt-1">
                        Km percorsi: {trip.kmPercorsi}
                      </p>
                      {/* Indicazione Danni/Segnalazioni */}
                      {trip.rientro.damages ? (
                        <p
                          className={`text-xs font-medium mt-2 flex items-center gap-1 text-red-600`}
                        >
                          <AlertTriangle className="w-3 h-3" />
                          Danni Segnalati: {trip.rientro.damages}
                        </p>
                      ) : (
                        <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                          <CheckCircle className="w-3 h-3 text-green-600" />
                          Nessun danno segnalato
                        </p>
                      )}
                      <div className="mt-4 flex gap-3">
                        <button
                          onClick={() => generatePDF(trip.rientro)}
                          disabled={generatingPdf}
                          className="text-sm text-gray-500 hover:text-gray-900 flex items-center gap-1 transition-colors disabled:opacity-50 font-medium"
                          title="Visualizza/Scarica PDF Verbale Rientro"
                        >
                          <Download className="w-4 h-4" /> Verbale
                        </button>
                        <button
                          onClick={() => openLogModal(trip.rientro)}
                          className="text-sm text-purple-600 hover:text-purple-900 flex items-center gap-1 transition-colors font-medium"
                          title="Modifica Report Rientro"
                        >
                          <Pencil className="w-4 h-4" /> Modifica
                        </button>
                        {/* Pulsante Elimina Report */}
                        <button
                          onClick={() => deleteLog(trip.rientro.id)}
                          className="text-sm text-red-600 hover:text-red-900 flex items-center gap-1 transition-colors font-medium ml-auto"
                          title="Elimina Report Rientro"
                        >
                          <Trash2 className="w-4 h-4" /> Elimina
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 border-2 border-dashed rounded-lg border-gray-300 text-gray-500 flex flex-col items-center justify-center h-full min-h-[150px]">
                      <Loader2 className="w-5 h-5 animate-spin mb-2" />
                      <p className="text-sm font-medium">Trip In Corso</p>
                      <p className="text-xs">In attesa di Rientro</p>
                    </div>
                  )}

                  {/* RITIRO (CONSEGNA) - SECONDO */}
                  {trip.consegna && (
                    <div className="p-3 border rounded-lg bg-red-50/50">
                      <h4 className="flex items-center gap-2 text-base font-semibold text-red-700 mb-2">
                        <ArrowRight className="w-4 h-4" /> Consegna
                      </h4>
                      <p className="text-sm text-gray-700">
                        <strong>Driver:</strong> {trip.consegna.driver}
                      </p>
                      <p className="text-sm text-gray-700">
                        <strong>Data:</strong> {formatDate(trip.consegna.date)}
                      </p>
                      <p className="text-sm text-gray-700">
                        <strong>Km Iniziali:</strong> {trip.consegna.km} |
                        <strong> Fuel:</strong> {trip.consegna.fuel}
                      </p>
                      <div className="mt-2 text-xs text-gray-500">
                        Commessa: {trip.consegna.commessa || "N/A"}
                      </div>
                      {/* Indicazione Danni/Segnalazioni */}
                      {trip.consegna.damages ? (
                        <p className="text-xs text-red-600 font-medium mt-2 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          Danni Segnalati: {trip.consegna.damages}
                        </p>
                      ) : (
                        <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                          <CheckCircle className="w-3 h-3 text-green-600" />
                          Nessun danno segnalato
                        </p>
                      )}
                      <div className="mt-4 flex gap-3">
                        <button
                          onClick={() => generatePDF(trip.consegna)}
                          disabled={generatingPdf}
                          className="text-sm text-gray-500 hover:text-gray-900 flex items-center gap-1 transition-colors disabled:opacity-50 font-medium"
                          title="Visualizza/Scarica PDF Verbale Consegna"
                        >
                          <Download className="w-4 h-4" /> Verbale
                        </button>
                        <button
                          onClick={() => openLogModal(trip.consegna)}
                          className="text-sm text-purple-600 hover:text-purple-900 flex items-center gap-1 transition-colors font-medium"
                          title="Modifica Report Consegna"
                        >
                          <Pencil className="w-4 h-4" /> Modifica
                        </button>
                        {/* Pulsante Elimina Report */}
                        <button
                          onClick={() => deleteLog(trip.consegna.id)}
                          className="text-sm text-red-600 hover:text-red-900 flex items-center gap-1 transition-colors font-medium ml-auto"
                          title="Elimina Report Consegna"
                        >
                          <Trash2 className="w-4 h-4" /> Elimina
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
        {filteredLogs.length > 0 && loadingData && (
          <div className="text-center py-4 text-gray-500">
            <Loader2 className="w-6 h-6 animate-spin mx-auto" />
          </div>
        )}
      </div>
    );
  };

  // --- INIZIALIZZAZIONE & FETCH DATI ---

  // HOOK 1: Inizializzazione Auth
  useEffect(() => {
    loadExternalScripts(setXlsxLoaded);

    const initAuth = async () => {
      try {
        if (auth && !auth.currentUser) {
          // Tenta l'accesso anonimo se non c'è un utente corrente
          await signInAnonymously(auth);
        }
      } catch (error) {
        console.error("Auth Error (Anonimo):", error);
        showToast("Errore Autenticazione Anonima.", "error");
      }

      // onAuthStateChanged è più affidabile per attendere la risposta iniziale di Firebase
      const unsubscribeAuth = onAuthStateChanged(auth, (u) => {
        setUser(u);
        const sessionAuth = sessionStorage.getItem("renco_auth_role");
        if (sessionAuth) {
          setAuthRole(sessionAuth as "guest" | "admin");
        }
        // Imposta isAuthReady a true solo dopo il primo controllo dello stato
        setIsAuthReady(true);
      });

      return () => unsubscribeAuth();
    };
    initAuth();
  }, []);

  // HOOK 2: Caricamento Dati (dipende da utente e ruolo)
  useEffect(() => {
    // Carica i dati solo se l'auth è pronto e il ruolo non è guest (o se si sta cercando di autenticarsi)
    if (!isAuthReady || authRole === "guest") {
      setLoadingData(false);
      return;
    }

    setLoadingData(true);
    setPermissionError(false);

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
  }, [isAuthReady, user, authRole]);

  // --- RETURN PRINCIPALE ---

  // 1. Mostra loader finché l'autenticazione non è pronta
  if (!isAuthReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-orange-600" />
      </div>
    );
  }

  // 2. Se non autenticato (guest role), mostra il login
  if (authRole === "guest") {
    return renderLogin();
  }

  // 3. Mostra l'app completa (admin role)
  const availableViews = ["dashboard", "flotta", "storico"];

  return (
    <div className="min-h-screen bg-slate-50 pb-20 font-sans text-slate-900">
      <Toast
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        onClose={() => setToast({ ...toast, visible: false })}
      />

      {/* BARRA SUPERIORE FISSA - RIPRISTINO COLORE ARANCIO E FIX SCROLL */}
      {/* Colore Header Renco: Arancio 600 */}
      <header className="bg-orange-600 text-white p-4 shadow-lg fixed w-full top-0 left-0 right-0 z-30 h-16">
        <div className="max-w-5xl mx-auto flex justify-between items-center h-full">
          <div className="flex items-center gap-3">
            {/* Logo Renco nell'Header (Bianco su Arancio) - FIX 2: SKIPPED "FLEET POOL" e applicato SKREW */}
            <RencoLogoHeader />
          </div>
          <button
            onClick={handleLogout}
            className="text-sm text-white/80 hover:text-white flex items-center gap-2 transition-colors shrink-0"
          >
            <LogIn className="w-4 h-4 rotate-180" /> Esci
          </button>
        </div>
      </header>
      {/* CORPO PRINCIPALE DELL'APP - AUMENTATO PADDING TOP PER FISSARE L'HEADER E COMPENSARE LA BARRA DI STATO MOBILE */}
      <div className="max-w-5xl mx-auto px-4 pt-[5rem] sm:pt-6">
        <nav className="flex gap-2 mb-6 bg-white p-1 rounded-xl shadow w-fit mt-4">
          {" "}
          {/* FIX 1: Aggiunto MT-4 per staccare dal bordo */}
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
      {selectedLog && modalMode === "editLog" && renderLogModal()}
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
