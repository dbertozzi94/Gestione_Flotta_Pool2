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
  Calendar,
  Clock,
  BookOpen,
  Wrench,
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
  orderBy,
  where,
  getDocs,
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
const PIN_UNICO = "RENCOMEZZI"; // PIN Unico per l'accesso (MODIFICATO: RENCOMEZZI)

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

// --- FUNZIONE SICURA PER ARRAY (FIX TypeError) ---
// Estremamente importante per i dati legacy di Firestore che potrebbero non essere Array.
const safeArray = (data: any) => (Array.isArray(data) ? data : []);

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
    // Stile per Prenotazione
    booking: "bg-purple-600 text-white hover:bg-purple-700 shadow-purple-100",
    // Nuovo stato Manutenzione/Riparazione
    maintenance: "bg-blue-600 text-white hover:bg-blue-700 shadow-blue-100",
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

// Nuova Badge per la prenotazione condizionale
const BookingBadge = () => (
  <span
    className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border bg-purple-100 text-purple-700 border-purple-200`}
  >
    Prenotato
  </span>
);
// Nuova Badge per la prenotazione in uso
const BookingInUseBadge = () => (
  <span
    className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border bg-orange-100 text-orange-700 border-orange-200`}
  >
    In Corso
  </span>
);

const DamageBadge = () => (
  <span
    className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border bg-red-100 text-red-700 border-red-200`}
  >
    Danneggiato
  </span>
);

const Badge = ({
  status,
  isUnderRepair,
  isUnderMaintenance,
}: {
  status: string;
  isUnderRepair: boolean;
  isUnderMaintenance: boolean;
}) => {
  const styles: any = {
    disponibile: "bg-green-100 text-green-700 border-green-200",
    impegnato: "bg-orange-100 text-orange-700 border-orange-200",
    riparazione: "bg-slate-500 text-white border-slate-600", // Manutenzione (Riparazione - Danni persistenti cancellati)
    manutenzione: "bg-blue-500 text-white border-blue-600", // Nuova Manutenzione (Danni non cancellati)
  };

  let displayStatus;

  if (isUnderRepair) {
    displayStatus = "riparazione"; // Vecchio stato (Danni cancellati)
  } else if (isUnderMaintenance) {
    displayStatus = "manutenzione"; // Nuovo stato (Danni non cancellati, solo per bloccare)
  } else {
    displayStatus = status.toLowerCase();
  }

  const displayText = isUnderRepair
    ? "In Ripristino"
    : isUnderMaintenance
    ? "In Manutenzione"
    : status;

  return (
    <span
      className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
        styles[displayStatus] || "bg-gray-100"
      }`}
    >
      {displayText}
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
  modalMode, // Passiamo modalMode come prop per la logica di pulizia in editLog
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
      // Se stiamo modificando un log, e non c'è una firma interna, il primo tocco deve cancellare l'initialSignature
      if (
        modalMode === "editLog" &&
        initialSignature &&
        !currentSignatureBase64
      ) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        setCurrentSignatureBase64(null);
        onSave(null); // Notifica l'esterno che la vecchia firma è stata eliminata.
      }
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

// NUOVO COMPONENTE: Upload Foto Danni/Segnalazioni
const DamagePhotoUpload = ({ photos, setPhotos, onShowToast, label }: any) => {
  const [compressing, setCompressing] = useState(false);

  // Riutilizzo la logica di compressione del codice
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
        {label}
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

// Messaggio Disclaimer Aggiornato (Punto 1)
const DAMAGE_DISCLAIMER =
  "In caso di danneggiamento, qualora il danno ammonti ad un valore superiore a 500€, la società si riserva il diritto di addebitare al dipendente il 20% dell'importo della riparazione";

// Data fittizia molto lontana per il calcolo dei conflitti (Anno 2099)
const FAR_FUTURE_DATE = new Date("2099-01-01T00:00:00.000Z").toISOString();

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
  // AGGIUNTO 'bookings' e 'danni' alla navigazione
  const [view, setView] = useState("dashboard");
  const [user, setUser] = useState<any>(null);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  // Nuovo stato per le prenotazioni
  const [bookings, setBookings] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [permissionError, setPermissionError] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchFleetTerm, setSearchFleetTerm] = useState("");
  const [searchDashboardTerm, setSearchDashboardTerm] = useState("");
  // Aggiunto stato per la prenotazione da modificare
  const [selectedVehicle, setSelectedVehicle] = useState<any>(null);
  const [selectedLog, setSelectedLog] = useState<any>(null);
  const [selectedBooking, setSelectedBooking] = useState<any>(null);
  // Aggiunto 'book' e 'editBook' a modalMode
  const [modalMode, setModalMode] = useState<string | null>(null);
  const [formData, setFormData] = useState<any>({});
  // Corretto: Inizializza checklist come tutti true per il default spuntato.
  const [checklist, setChecklist] = useState<any>(() => {
    const initialChecklist: any = {};
    CHECKLIST_ITEMS.forEach((item) => (initialChecklist[item.id] = true));
    return initialChecklist;
  });
  // Nuovi stati per le foto separate
  const [damagePhotos, setDamagePhotos] = useState<any[]>([]); // Foto Danni (Persistenti)
  const [signalingPhotos, setSignalingPhotos] = useState<any[]>([]); // Foto Segnalazioni (Solo Log)

  const [signature, setSignature] = useState<string | null>(null);
  const [xlsxLoaded, setXlsxLoaded] = useState(true);

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

  // Funzione per formattare data e ora per i picker HTML
  const formatDateTimeLocal = (isoString?: string) => {
    const date = isoString ? new Date(isoString) : new Date();
    date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
    return date.toISOString().slice(0, 16);
  };

  // --- FUNZIONI DI LOGICA BUSINESS ---

  // Funzione per verificare se un veicolo ha danni
  const hasPersistentDamages = (vehicle: any) => {
    // FIX V87: Usiamo safeArray per garantire che v.persistentDamages sia un array
    return (safeArray(vehicle.persistentDamages).length || 0) > 0;
  };

  // Funzione per verificare se un veicolo ha prenotazioni future
  const hasFutureBookings = (vehicleId: string | undefined) => {
    if (!vehicleId) return false;
    const now = new Date().getTime();
    // Il controllo esclude le prenotazioni che sono già scadute
    return bookings.some(
      (b) =>
        b.vehicleId === vehicleId &&
        new Date(b.returnDate || b.date).getTime() > now
    );
  };

  // Funzione per determinare se il veicolo ha una prenotazione attiva o futura (per il badge)
  const isVehicleBooked = (
    vehicleId: string,
    currentBookingId: string | null
  ) => {
    const now = new Date().getTime();

    // Filtra solo le prenotazioni FUTURE (dopo 'adesso') E non quella che sta per essere iniziata (currentBookingId)
    const futureCommitments = bookings.filter(
      (b) =>
        b.vehicleId === vehicleId &&
        b.id !== currentBookingId && // Escludi la prenotazione attualmente associata al mezzo
        new Date(b.returnDate || b.date).getTime() > now
    );

    return futureCommitments.length > 0;
  };

  // Funzione per verificare il conflitto di prenotazione
  const checkBookingConflict = (
    vehicleId: string,
    newStart: string,
    newEnd: string,
    existingBookings: any[],
    currentBookingIdToExclude: string | null = null,
    currentVehicleStatus: string = "disponibile",
    currentReturnDateExpected: string | null = null
  ) => {
    const newStartMs = new Date(newStart).getTime();
    const newEndMs = new Date(newEnd).getTime();

    // 0. Controlla se le date sono valide
    if (newStartMs >= newEndMs) {
      return "La data di rientro presunta deve essere successiva alla data di ritiro.";
    }

    // 1. Controlla conflitto con prenotazioni future esistenti
    const conflictingBooking = existingBookings.find((booking) => {
      if (booking.vehicleId !== vehicleId) return false;
      // Esclude la prenotazione che stiamo gestendo (modifica o checkout)
      if (currentBookingIdToExclude && booking.id === currentBookingIdToExclude)
        return false;

      const existingStartMs = new Date(booking.date).getTime();
      const existingEndMs = new Date(booking.returnDate).getTime();

      // Check di sovrapposizione: (InizioA < FineB) && (FineA > InizioB)
      const overlap = newStartMs < existingEndMs && newEndMs > existingStartMs;

      return overlap;
    });

    if (conflictingBooking) {
      return `Conflitto: il veicolo è già prenotato da ${
        conflictingBooking.driver
      } dal ${formatDate(conflictingBooking.date)} al ${formatDate(
        conflictingBooking.returnDate
      )}.`;
    }

    // 2. Controlla conflitto con l'occupazione attuale del veicolo (se è fuori)
    if (currentVehicleStatus === "impegnato" && currentReturnDateExpected) {
      // Utilizza la data nel 2099 se non specificata (per il calcolo dei conflitti)
      const expectedReturnIso = currentReturnDateExpected || FAR_FUTURE_DATE;
      const currentExpectedReturnMs = new Date(expectedReturnIso).getTime();

      // Se l'attuale rientro previsto è SUCCESSIVO all'inizio della NUOVA prenotazione, c'è conflitto.
      if (currentExpectedReturnMs > newStartMs) {
        // Se la data è quella fittizia (2099), restituisci un messaggio generico di indisponibilità
        if (expectedReturnIso === FAR_FUTURE_DATE) {
          return `Conflitto: il veicolo è in uso e NON ha una data di rientro prevista. Impossibile prenotare.`;
        }
        return `Conflitto: il veicolo è in uso con rientro previsto il ${formatDate(
          currentReturnDateExpected
        )}. Questa data è successiva all'inizio della tua prenotazione.`;
      }
    }

    return null; // Nessun conflitto
  };

  // --- FUNZIONI DI GENERAZIONE PDF ---

  // Funzione helper che crea il PDF come oggetto jspdf e lo restituisce (Generazione al volo)
  const generatePDFDocument = (logData: any, deliveryLog: any) => {
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
      let xVehicleData = 20;
      const vehiclePhotoWidth = 30;
      const vehiclePhotoHeight = 30;

      // NUOVO PUNTO: Aggiungi foto veicolo se presente
      if (logData.imageUrl) {
        try {
          // Aggiungi immagine base64 (ridimensionata per il riquadro)
          doc.addImage(
            logData.imageUrl,
            "JPEG",
            20,
            yPos + 2,
            vehiclePhotoWidth,
            vehiclePhotoHeight
          );
          xVehicleData += vehiclePhotoWidth + 5; // Sposta il testo a destra dell'immagine
        } catch (e) {
          console.warn("Errore aggiunta foto veicolo al PDF", e);
        }
      }

      doc.setFont("helvetica", "bold");
      doc.text("VEICOLO", xVehicleData, yPos + 10);
      doc.setFont("helvetica", "normal");
      doc.text(`${logData.vehicleModel}`, xVehicleData, yPos + 17);
      doc.setFont("helvetica", "bold");
      doc.text(`${logData.plate}`, xVehicleData, yPos + 23);

      // Colonna 2: Assegnatario
      doc.text("ASSEGNATARIO", 100, yPos + 10);
      doc.setFont("helvetica", "normal");
      doc.text(`${logData.driver || "N/A"}`, 100, yPos + 17);
      // Commessa
      doc.text(`Commessa: ${logData.commessa || "N/A"}`, 100, yPos + 23);
      // Rientro Previsto
      if (logData.returnDateExpected) {
        doc.text(
          `Rientro Previsto: ${formatDate(logData.returnDateExpected)}`,
          100,
          yPos + 29
        );
      }

      // Colonna 3: Stato
      doc.setFont("helvetica", "bold");
      doc.text("KM/FUEL", 160, yPos + 10);
      doc.setFont("helvetica", "normal");
      doc.text(`${logData.km} km`, 160, yPos + 17);
      doc.text(`Fuel: ${logData.fuel}`, 160, yPos + 23);

      yPos += 50;

      // --- 1. SEZIONE DOTAZIONI (Checklist) ---

      const items = CHECKLIST_ITEMS;
      if (logData.checklist && Object.keys(logData.checklist).length > 0) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.text("DOTAZIONI E DOCUMENTI", 14, yPos);
        yPos += 8;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);

        // Trova log di Consegna (per confronto)
        const deliveryChecklist = deliveryLog?.checklist || {};

        items.forEach((item, index) => {
          const isPresent = logData.checklist[item.id];
          const wasPresentOnDelivery = deliveryChecklist[item.id];

          let checkText = isPresent ? "[SI]" : "[NO]";
          let textColor: [number, number, number] = isPresent
            ? [0, 150, 0]
            : [200, 0, 0]; // RGB

          // Punto 5: Evidenziare se mancante al Rientro ma presente alla Consegna
          if (
            logData.type === "Rientro" &&
            !isPresent &&
            wasPresentOnDelivery
          ) {
            checkText += " (MANCANTE)";
            textColor = [255, 0, 0]; // Rosso vivo
          }

          doc.setTextColor(...textColor);

          doc.text(`${checkText} ${item.label}`, 14 + (index % 2) * 90, yPos);
          if (index % 2 === 1) yPos += 6;
        });
        if (items.length % 2 === 1) yPos += 6; // Se dispari, aggiungi spazio
        yPos += 8;
      }

      // --- 2. SEZIONE DANNI E SEGNALAZIONI (Testo) ---

      const persistentDamages = safeArray(logData.persistentDamages);
      const newDamagesEntry = logData.damages; // Stringa di testo (nuovi danni)

      const hasPersistentDamagesList = persistentDamages.length > 0;
      const hasNewDamagesText = !!newDamagesEntry;

      doc.setTextColor(0, 0, 0);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);

      if (hasPersistentDamagesList || hasNewDamagesText || logData.notes) {
        doc.text("DANNI E SEGNALAZIONI", 14, yPos);
        yPos += 8;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);

        let listYPos = yPos;
        let lineSpacing = 6;

        // 2.1 Danni Preesistenti (solo se esistono)
        if (hasPersistentDamagesList) {
          doc.setTextColor(150, 0, 0); // Rosso più scuro per i danni
          doc.setFont("helvetica", "bold");
          doc.text("Danni Preesistenti:", 14, listYPos);
          listYPos += lineSpacing;

          persistentDamages.forEach((d: any) => {
            doc.setFont("helvetica", "normal");
            doc.text(`- Trip #${d.tripId}: ${d.description}`, 14, listYPos);
            listYPos += lineSpacing;
          });
          listYPos += lineSpacing / 2;
        } else {
          doc.setTextColor(100, 100, 100);
          doc.text("Danni Preesistenti: N/A", 14, listYPos);
          listYPos += lineSpacing;
        }

        // 2.2 Nuovi Danni Registrati (solo se presenti nel form attuale)
        if (hasNewDamagesText) {
          doc.setTextColor(255, 0, 0); // Rosso vivo per i nuovi danni
          doc.setFont("helvetica", "bold");
          doc.text(`Nuovi Danni/Anomalie Registrate:`, 14, listYPos);
          listYPos += lineSpacing;

          doc.setFont("helvetica", "normal");
          doc.text(newDamagesEntry, 14, listYPos);
          listYPos += lineSpacing;
          listYPos += lineSpacing / 2;
        } else {
          // Punto 1: Colorazione dinamica N/A (Rossastro chiaro)
          doc.setTextColor(230, 120, 120); // Rosso più vivido
          doc.setFont("helvetica", "bold"); // Rendi il testo N/A in grassetto per coerenza con gli altri titoli
          doc.text("Nuovi Danni/Anomalie: N/A", 14, listYPos);
          listYPos += lineSpacing;
        }

        // 2.3 Segnalazioni Generiche (Testo)
        doc.setTextColor(0, 0, 0);
        doc.setFont("helvetica", "bold");
        // FIX P.3: Calcola la posizione del testo N/A per le Segnalazioni Generiche
        const labelNotes = "Segnalazioni Generiche: ";
        const textNotes = logData.notes || "N/A";

        doc.text(labelNotes, 14, listYPos);
        doc.setFont("helvetica", "normal");
        doc.text(textNotes, 14 + doc.getTextWidth(labelNotes), listYPos, {
          maxWidth: pageWidth - 14 - doc.getTextWidth(labelNotes),
        }); // Mantiene il testo sulla stessa linea

        listYPos += lineSpacing;

        yPos = listYPos + 4;
      }

      // --- 3. FOTO: Danni Preesistenti (Da Veicolo) ---
      const existingDamagePhotos = safeArray(logData.existingDamagePhotos);
      if (existingDamagePhotos.length > 0) {
        if (yPos > 240) {
          doc.addPage();
          yPos = 20;
        }

        doc.setTextColor(0, 0, 0);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.text("FOTO DANNI PREESISTENTI", 14, yPos);
        yPos += 8;

        let xOffset = 14;
        const photoWidth = 50;
        const photoHeight = 50;

        existingDamagePhotos.forEach((photo: string) => {
          if (xOffset + photoWidth > pageWidth - 14) {
            xOffset = 14;
            yPos += photoHeight + 5;
          }
          if (yPos + photoHeight > 270) {
            doc.addPage();
            yPos = 20;
            xOffset = 14;
          }

          try {
            doc.addImage(photo, "JPEG", xOffset, yPos, photoWidth, photoHeight);
            xOffset += photoWidth + 5;
          } catch (e) {
            console.warn(
              "Errore aggiunta immagine danno preesistente al PDF",
              e
            );
          }
        });
        yPos += photoHeight + 10;
      }

      // --- 4. FOTO NUOVI DANNI (DA QUESTO VERBALE) ---
      const newDamagePhotos = safeArray(logData.newDamagePhotos);
      if (newDamagePhotos.length > 0) {
        if (yPos > 240) {
          doc.addPage();
          yPos = 20;
        }

        doc.setTextColor(0, 0, 0);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.text("FOTO NUOVI DANNI", 14, yPos);
        yPos += 8;

        let xOffset = 14;
        const photoWidth = 50;
        const photoHeight = 50;

        newDamagePhotos.forEach((photo: string) => {
          if (xOffset + photoWidth > pageWidth - 14) {
            xOffset = 14;
            yPos += photoHeight + 5;
          }
          if (yPos + photoHeight > 270) {
            doc.addPage();
            yPos = 20;
            xOffset = 14;
          }

          try {
            doc.addImage(photo, "JPEG", xOffset, yPos, photoWidth, photoHeight);
            xOffset += photoWidth + 5;
          } catch (e) {
            console.warn("Errore aggiunta immagine nuovo danno al PDF", e);
          }
        });
        yPos += photoHeight + 10;
      }

      // --- 5. SEZIONE FOTO SEGNALAZIONI ---
      const signalingPhotos = safeArray(logData.signalingPhotos);
      if (signalingPhotos.length > 0) {
        if (yPos > 240) {
          doc.addPage();
          yPos = 20;
        }

        doc.setTextColor(0, 0, 0);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.text("FOTO SEGNALAZIONI", 14, yPos);
        yPos += 8;

        let xOffset = 14;
        const photoWidth = 50;
        const photoHeight = 50;

        signalingPhotos.forEach((photo: string) => {
          if (xOffset + photoWidth > pageWidth - 14) {
            xOffset = 14;
            yPos += photoHeight + 5;
          }
          if (yPos + photoHeight > 270) {
            doc.addPage();
            yPos = 20;
            xOffset = 14;
          }

          try {
            doc.addImage(photo, "JPEG", xOffset, yPos, photoWidth, photoHeight);
            xOffset += photoWidth + 5;
          } catch (e) {
            console.warn("Errore aggiunta immagine segnalazione al PDF", e);
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

        // NUOVO MESSAGGIO DISCLAIMER (Punto 1)
        const disclaimerLines = DAMAGE_DISCLAIMER.split(
          "la società si riserva"
        );
        doc.text(disclaimerLines[0], 14, yPos);
        doc.text(`la società si riserva${disclaimerLines[1]}`, 14, yPos + 4);
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

    // FIX: Assicuriamo che i campi danno e foto persistenti siano presenti nel logData,
    // anche se sono nulli nel log storico, li recuperiamo dal record veicolo se necessario.
    const vehicle = vehicles.find((v) => v.id === logData.vehicleId);

    // Preparo i dati per il PDF in un formato più pulito, includendo foto persistenti e log correnti
    const augmentedLogData = {
      ...logData,
      // Danni registrati nel log (nuovi danni)
      damages: logData.damages || "",

      // Danni Preesistenti (Lista di oggetti danno dal log o dal veicolo)
      persistentDamages: safeArray(
        logData.persistentDamages || vehicle?.persistentDamages
      ),

      // Foto Danni Preesistenti: Foto che sono sul veicolo (quelle persistenti)
      existingDamagePhotos: safeArray(vehicle?.damagePhotos),

      // Foto Nuovi Danni (caricati in questo log)
      newDamagePhotos: safeArray(
        logData.newDamagePhotos || logData.damagePhotos
      ),
      // Foto Segnalazioni (caricati in questo log)
      signalingPhotos: safeArray(logData.photos || logData.signalingPhotos),
    };

    // Al momento del rientro, i "danni preesistenti" nel verbale sono quelli che erano sul log di consegna.
    // Qui usiamo la lista di danni del veicolo come riferimento.

    // Trova il log di Consegna per il confronto della checklist
    const deliveryLog =
      logData.type === "Rientro"
        ? logs.find((l) => l.tripId === logData.tripId && l.type === "Consegna")
        : null;

    const pdfDoc = generatePDFDocument(augmentedLogData, deliveryLog);

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
  const openModal = (mode: string, data: any = null) => {
    // Solo Admin può aggiungere/modificare/prenotare/gestire danni
    if (
      (mode === "add" ||
        mode === "edit" ||
        mode === "book" ||
        mode === "editBook" ||
        mode === "book_checkout" ||
        mode === "danni") &&
      authRole !== "admin"
    ) {
      showToast(
        "Accesso negato: solo gli amministratori possono gestire la flotta.",
        "error"
      );
      return;
    }
    setModalMode(mode);
    setSelectedLog(null);
    // Corretto: Inizializza checklist come tutti true PER DEFAULT.
    const initialChecklist: any = {};
    CHECKLIST_ITEMS.forEach((item) => (initialChecklist[item.id] = true));

    // Inizializza foto separate
    setDamagePhotos([]);
    setSignalingPhotos([]);
    setSignature(null);

    // Variabili per l'inizializzazione
    const now = formatDateTimeLocal();
    const future = new Date(new Date().getTime() + 3600000 * 24); // 24 ore dopo
    const futureTime = formatDateTimeLocal(future.toISOString());

    // Gestione Checkout da Prenotazione (data è la prenotazione, serve trovare il veicolo)
    if (mode === "book_checkout") {
      const vehicle = vehicles.find((v) => v.id === data.vehicleId);
      setSelectedVehicle(vehicle);
      setSelectedBooking(data);
      setFormData({
        model: vehicle?.model,
        plate: vehicle?.plate,
        km: vehicle?.km,
        fuel: vehicle?.fuel || "Pieno",
        // Pre-fill con i dati di prenotazione
        driver: data.driver || "",
        commessa: data.commessa || "",
        imageUrl: vehicle?.imageUrl || "",
        // Data rientro prevista presa dalla prenotazione
        returnDate: formatDateTimeLocal(data.returnDate),
        // Danni persistenti
        persistentDamages: safeArray(vehicle?.persistentDamages),
        damages: "",
      });

      // FIX P.1: NON CARICARE FOTO DANNI PREESISTENTI NEL CAMPO INPUT
      setDamagePhotos([]);

      setModalMode("checkout"); // Forzo la modale di checkout (Consegna)
      return;
    }

    // Gestione Modifica Prenotazione
    if (mode === "editBook") {
      setSelectedBooking(data); // data è la prenotazione
      setSelectedVehicle(vehicles.find((v) => v.id === data.vehicleId));
      setFormData({
        reservationDriver: data.driver || "",
        reservationCommessa: data.commessa || "",
        reservationDateStart: formatDateTimeLocal(data.date),
        reservationDateEnd: formatDateTimeLocal(data.returnDate),
      });
      return;
    }

    // Gestione Checkout/Checkin/Add/Book (data è il veicolo)
    setSelectedBooking(null);
    setSelectedVehicle(data);

    if (data) {
      // FIX P.2: Aggiorna la checklist per riflettere le dotazioni mancanti all'ultimo rientro
      const missingItems = safeArray(data.missingChecklistItems);
      const newChecklist = { ...initialChecklist };

      if (data.status === "disponibile" && missingItems.length > 0) {
        missingItems.forEach((id) => {
          newChecklist[id] = false; // Spunta come mancante
        });
      }
      setChecklist(newChecklist);

      setFormData({
        model: data.model,
        plate: data.plate,
        km: data.km,
        fuel: data.fuel || "Pieno",
        driver: data.driver || "",
        commessa: data.commessa || "",
        imageUrl: data.imageUrl || "",
        currentSignature: null,
        reservationDriver: "",
        reservationCommessa: "",
        reservationDateStart: now,
        reservationDateEnd: futureTime,
        // Data di rientro prevista dal veicolo corrente (se in uso)
        returnDate:
          data.returnDateExpected && data.returnDateExpected !== FAR_FUTURE_DATE
            ? formatDateTimeLocal(data.returnDateExpected)
            : "",
        // Danni persistenti sul veicolo
        persistentDamages: safeArray(data.persistentDamages),
        damages: "", // Danni correnti puliti
      });
      // FIX P.1: NON CARICARE FOTO DANNI PREESISTENTI NEL CAMPO INPUT
      setDamagePhotos([]);
    } else {
      setFormData({
        imageUrl: "",
        currentSignature: null,
        reservationDriver: "",
        reservationCommessa: "",
        reservationDateStart: now,
        reservationDateEnd: futureTime,
        returnDate: "",
        persistentDamages: [],
        damages: "",
      });
    }
  };

  const openLogModal = (log: any) => {
    setModalMode("editLog");
    setSelectedLog(log);
    setSelectedVehicle(null);
    // PULISCIE FIRMA: setSignature a null per forzare una nuova firma (PUNTO 3)
    setSignature(null);
    setChecklist(log.checklist || {});
    // Carica foto separate (Log: photos -> signalingPhotos; danni da persistenza -> damagePhotos)
    setSignalingPhotos(safeArray(log.photos));
    setDamagePhotos(safeArray(log.damagePhotos));

    setFormData({
      km: log.km,
      fuel: log.fuel,
      notes: log.notes || "",
      damages: log.damages || "",
      // Danni persistenti dal log
      persistentDamages: safeArray(log.persistentDamages),
      // Passiamo la firma originale per il rendering
      originalSignature: log.signature || null,
      currentSignature: null, // Firma per la modifica
    });
  };

  const closeModal = () => {
    setModalMode(null);
    setSelectedVehicle(null);
    setSelectedLog(null);
    setSelectedBooking(null);
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

  // FUNZIONE: Ripara Veicolo (Pagina Danni)
  const repairVehicle = async (
    vehicle: any,
    action:
      | "start_maintenance"
      | "end_maintenance"
      | "full_repair"
      | "full_repair_end"
  ) => {
    if (authRole !== "admin" || !db) return;

    // Definizioni per i due tipi di manutenzione
    const isFullRepairAction =
      action === "full_repair" || action === "full_repair_end";

    const isCurrentlyUnderRepair =
      vehicle.status === "manutenzione" && vehicle.isUnderRepair;
    const isCurrentlyUnderMaintenance =
      vehicle.status === "manutenzione" && vehicle.isUnderMaintenance;
    const isCurrentlyUnderAction =
      isCurrentlyUnderRepair || isCurrentlyUnderMaintenance;

    let updateData: any = {};
    let successMessage = "";
    let actionTitle = "";

    if (isFullRepairAction) {
      // Punto 1: Rinomina pulsante "Riparazione" -> "Ripristino"
      actionTitle = isCurrentlyUnderRepair
        ? "Termina Ripristino"
        : "Inizia Ripristino";
      if (action === "full_repair_end") {
        // TERMINA RIPARAZIONE (Cancella Danni)
        updateData = {
          persistentDamages: [],
          damagePhotos: [],
          isUnderRepair: false,
          isUnderMaintenance: false,
          status: "disponibile",
          missingChecklistItems: [],
        };
        successMessage = `Veicolo ${vehicle.plate} ripristino terminato. Danni azzerati.`;
      } else {
        // full_repair (Inizia)
        // INIZIA RIPARAZIONE (Mette in manutenzione e blocca)
        updateData = {
          isUnderRepair: true,
          status: "manutenzione",
          isUnderMaintenance: false,
        };
        successMessage = `Veicolo ${vehicle.plate} messo in stato 'In Ripristino'.`;
      }
    } else {
      // Manutenzione Leggera (action is 'start_maintenance' or 'end_maintenance')
      actionTitle = isCurrentlyUnderMaintenance
        ? "Termina Manutenzione"
        : "Inizia Manutenzione";
      if (action === "end_maintenance") {
        // TERMINA MANUTENZIONE (Non cancella Danni)
        updateData = { isUnderMaintenance: false, status: "disponibile" };
        successMessage = `Veicolo ${vehicle.plate} manutenzione terminata.`;
      } else {
        // start_maintenance (Inizia)
        // INIZIA MANUTENZIONE (Mette in manutenzione e blocca)
        updateData = {
          isUnderMaintenance: true,
          status: "manutenzione",
          isUnderRepair: false,
        };
        successMessage = `Veicolo ${vehicle.plate} messo in stato 'In Manutenzione'.`;
      }
    }

    // Validazione per l'inizio di qualsiasi blocco (Riparazione o Manutenzione)
    if (!isCurrentlyUnderAction && vehicle.status !== "disponibile") {
      showToast(
        `Impossibile iniziare l'azione. Il mezzo non è 'Disponibile'.`,
        "error"
      );
      return;
    }

    // Validazione per Terminare un'azione che non è quella corrente
    if (isCurrentlyUnderAction) {
      if (isFullRepairAction && !isCurrentlyUnderRepair) {
        showToast(
          `Impossibile Termina Ripristino: il mezzo è in Manutenzione.`,
          "error"
        );
        return;
      }
      if (!isFullRepairAction && !isCurrentlyUnderMaintenance) {
        showToast(
          `Impossibile Termina Manutenzione: il mezzo è in Ripristino.`,
          "error"
        );
        return;
      }
    }

    setConfirmModal({
      isOpen: true,
      title: `${actionTitle} ${vehicle.model}`,
      message: isCurrentlyUnderAction
        ? `Sei sicuro di voler terminare l'azione? Lo stato tornerà a 'Disponibile'.`
        : `Sei sicuro di voler iniziare l'azione? Lo stato verrà cambiato a 'Manutenzione' e il mezzo sarà bloccato.`,
      onConfirm: async () => {
        setConfirmModal({ isOpen: false });
        try {
          const vehicleRef = getPublicDocRef("vehicles", vehicle.id);

          await updateDoc(vehicleRef, updateData);
          showToast(successMessage, "success");
        } catch (err) {
          // *** FIX ERRORE TRANSAZIONE: Logging dettagliato dell'errore. ***
          console.error("ERRORE DURANTE updateDoc:", err);
          showToast(
            `Errore durante l'azione di ${actionTitle.toLowerCase()}. Controllare la console.`,
            "error"
          );
        }
      },
      onCancel: () => setConfirmModal({ isOpen: false }),
    });
  };

  // --- FUNZIONI DI GESTIONE (HANDLE...) ---

  // FUNZIONE: Modifica Prenotazione (Punto 2)
  const handleEditBooking = async (e: any) => {
    e.preventDefault();
    if (authRole !== "admin" || !db || !selectedBooking) return;

    const { reservationDateStart, reservationDateEnd } = formData;
    const vehicleToEdit = vehicles.find(
      (v) => v.id === selectedBooking.vehicleId
    );

    // 1. Dati veicolo (per check conflitto con rientro attuale se in uso)
    const vehicleData = vehicles.find(
      (v) => v.id === selectedBooking.vehicleId
    );
    // USO la data lontana se non c'è il rientro previsto nel veicolo, solo per il calcolo.
    const returnDateExpected =
      vehicleData?.returnDateExpected || FAR_FUTURE_DATE;

    // 2. Validazione Conflitti
    const conflictMessage = checkBookingConflict(
      selectedBooking.vehicleId,
      reservationDateStart,
      reservationDateEnd,
      bookings,
      selectedBooking.id, // Esclude la prenotazione corrente
      vehicleData?.status, // Passa lo stato attuale
      returnDateExpected // Passa il rientro previsto attuale
    );

    if (conflictMessage) {
      showToast(conflictMessage, "error");
      return;
    }

    try {
      const bookingRef = getPublicDocRef("bookings", selectedBooking.id);

      await updateDoc(bookingRef, {
        driver: formData.reservationDriver,
        commessa: formData.reservationCommessa || null,
        date: reservationDateStart,
        returnDate: reservationDateEnd,
        lastModified: new Date().toISOString(),
      });

      closeModal();
      showToast(
        `Prenotazione per ${vehicleToEdit?.plate} aggiornata con successo.`,
        "success"
      );
    } catch (err) {
      console.error(err);
      showToast("Errore aggiornamento prenotazione.", "error");
    }
  };

  // FUNZIONE: Nuova Prenotazione
  const handleBooking = async (e: any) => {
    e.preventDefault();
    if (authRole !== "admin" || !db || !selectedVehicle) return;

    const { reservationDateStart, reservationDateEnd } = formData;

    // 1. Dati veicolo (per check conflitto con rientro attuale se in uso)
    const returnDateExpected =
      selectedVehicle.returnDateExpected || FAR_FUTURE_DATE;

    // 2. Validazione Conflitti
    const conflictMessage = checkBookingConflict(
      selectedVehicle.id,
      reservationDateStart,
      reservationDateEnd,
      bookings,
      null, // Nuova prenotazione, nessun ID da escludere
      selectedVehicle.status, // Passa lo stato attuale
      returnDateExpected // Passa il rientro previsto attuale
    );

    if (conflictMessage) {
      showToast(conflictMessage, "error");
      return;
    }

    try {
      const bookingData = {
        vehicleId: selectedVehicle.id,
        vehicleModel: selectedVehicle.model,
        plate: selectedVehicle.plate,
        driver: formData.reservationDriver,
        commessa: formData.reservationCommessa || null,
        date: reservationDateStart, // Data Ritiro Presunta
        returnDate: reservationDateEnd, // Data Rientro Presunta
        createdAt: new Date().toISOString(),
      };

      await addDoc(getPublicCollectionPath("bookings"), bookingData);
      closeModal();
      showToast(
        `Prenotazione per ${selectedVehicle.plate} salvata per ${formData.reservationDriver}.`,
        "success"
      );
    } catch (err) {
      console.error(err);
      showToast("Errore salvataggio prenotazione.", "error");
    }
  };

  // FUNZIONE: Elimina Prenotazione
  const deleteBooking = async (bookingId: string) => {
    if (authRole !== "admin" || !db) return;

    setConfirmModal({
      isOpen: true,
      title: "Conferma Cancellazione Prenotazione",
      message:
        "Sei sicuro di voler eliminare questa prenotazione? L'operazione è irreversibile.",
      onConfirm: async () => {
        setConfirmModal({ isOpen: false });
        try {
          await deleteDoc(getPublicDocRef("bookings", bookingId));
          showToast("Prenotazione eliminata.", "success");
        } catch (err) {
          showToast("Errore cancellazione prenotazione.", "error");
        }
      },
      onCancel: () => setConfirmModal({ isOpen: false }),
    });
  };

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
          returnDateExpected: null, // Nuovo campo rientro previsto
          // NUOVI CAMPI DANNI PERSISTENTI (Inizializzati come array vuoto)
          persistentDamages: [],
          damagePhotos: [],
          isUnderRepair: false, // Nuovo stato riparazione (per Riparazione Danni)
          isUnderMaintenance: false, // Nuovo stato (Manutenzione senza azzeramento danni)
          missingChecklistItems: [], // Dotazioni mancanti
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
        photos: signalingPhotos, // Photos ora sono solo le segnalazioni
        damagePhotos: damagePhotos, // Nuove foto danni
        lastModified: new Date().toISOString(),
      });

      // 2. Aggiorna il record veicolo per i danni persistenti (solo se il log è il più recente)
      const vehicle = vehicles.find((v) => v.id === selectedLog.vehicleId);
      if (vehicle) {
        const vehicleRef = getPublicDocRef("vehicles", vehicle.id);

        // Somma i vecchi danni persistenti (se non siamo in modalità Consegna) con i nuovi
        const currentPersistentDamages = safeArray(
          selectedLog.persistentDamages
        );
        const newDamageEntry = formData.damages
          ? [
              {
                tripId: selectedLog.tripId,
                description: formData.damages,
                photos: damagePhotos,
              },
            ]
          : [];

        // Se si modifica un log con danni, assumiamo che l'utente stia correggendo l'ultima registrazione di danno
        const updatedPersistentDamages = [
          ...currentPersistentDamages,
          ...newDamageEntry,
        ];
        const updatedDamagePhotos = [...damagePhotos]; // Qui assumiamo che damagePhotos contenga tutto il set corretto

        await updateDoc(vehicleRef, {
          km: parseInt(formData.km) || vehicle.km,
          fuel: formData.fuel,
          // Aggiorna anche i campi danno sul veicolo
          persistentDamages: updatedPersistentDamages,
          damagePhotos: updatedDamagePhotos,
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

  // FUNZIONE: Elimina Log (Storico)
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

  // FUNZIONE: Elimina Intero Trip (Storico)
  const deleteTrip = async (tripId: string) => {
    if (authRole !== "admin" || !db) {
      showToast(
        "Accesso negato: solo gli amministratori possono eliminare i report.",
        "error"
      );
      return;
    }

    setConfirmModal({
      isOpen: true,
      title: `Conferma Eliminazione Trip #${tripId}`,
      message: `Sei sicuro di voler eliminare permanentemente tutti i report associati al Trip #${tripId}? L'operazione è irreversibile.`,
      onConfirm: async () => {
        setConfirmModal({ isOpen: false });
        try {
          // Trova tutti i documenti log con questo tripId
          const logsRef = getPublicCollectionPath("logs");
          const q = query(logsRef, where("tripId", "==", tripId));
          const snapshot = await getDocs(q);

          let deletedCount = 0;

          for (const doc of snapshot.docs) {
            await deleteDoc(doc.ref);
            deletedCount++;
          }

          showToast(
            `Trip #${tripId} eliminato (cancellati ${deletedCount} report).`,
            "success"
          );
        } catch (err) {
          showToast(`Errore eliminazione Trip #${tripId}.`, "error");
        }
      },
      onCancel: () => setConfirmModal({ isOpen: false }),
    });
  };

  // FUNZIONE: Transazione Check-in / Check-out (SALVA LOG SU DB)
  const handleTransaction = async (e: any) => {
    e.preventDefault();

    // Validazione Firma Enforced (JS Enforced)
    if (!signature || !db) {
      showToast("Firma obbligatoria.", "error");
      return;
    }

    const type = modalMode === "checkout" ? "Consegna" : "Rientro"; // NOME AGGIORNATO
    const newStatus = modalMode === "checkout" ? "impegnato" : "disponibile";
    const now = new Date().getTime();

    if (modalMode === "checkin" && parseInt(formData.km) < selectedVehicle.km) {
      showToast(
        `I Km inseriti (${formData.km}) devono essere maggiori o uguali a quelli di Consegna (${selectedVehicle.km}).`,
        "error"
      );
      return;
    }

    // --- VALIDAZIONE PRENOTAZIONE SOLO PER CONSEGNA (CHECKOUT) ---
    if (modalMode === "checkout") {
      const plannedReturn = formData.returnDate
        ? new Date(formData.returnDate).getTime()
        : null;

      // Trova la prima prenotazione futura
      const firstFutureBooking = bookings
        .filter(
          (b) =>
            b.vehicleId === selectedVehicle.id &&
            new Date(b.returnDate || b.date).getTime() > now
        )
        .sort(
          (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
        )[0];

      // 1. Check se il mezzo ha prenotazioni future (che non siano quella che sto evadendo)
      const hasFutureBookingsNow = bookings.some(
        (b) =>
          b.vehicleId === selectedVehicle.id &&
          new Date(b.returnDate || b.date).getTime() > now &&
          b.id !== selectedBooking?.id
      );

      // Validazione: La prenotazione più vicina è già INIZIATA E non è la prenotazione che stiamo evadendo
      if (
        firstFutureBooking &&
        now > new Date(firstFutureBooking.date).getTime() &&
        firstFutureBooking.id !== selectedBooking?.id
      ) {
        showToast(
          `ERRORE: Impossibile consegnare. La prenotazione di ${
            firstFutureBooking.driver
          } è iniziata il ${formatDate(
            firstFutureBooking.date
          )}. Modifica/Cancella prima la prenotazione scaduta.`,
          "error"
        );
        return;
      }

      // 2. Validazione Rientro Previsto obbligatoria e controllo conflitto rigido
      if (hasFutureBookingsNow) {
        // Se ci sono prenotazioni future, la data di rientro è obbligatoria. (JS Enforced)
        if (!formData.returnDate) {
          showToast(
            `La riconsegna deve avere una Data di Rientro Prevista per evitare conflitti con la prenotazione di ${
              firstFutureBooking.driver
            } del ${formatDate(firstFutureBooking.date)}.`,
            "error"
          );
          return;
        }

        // Validazione CONFLITTO DATA INSERITA (Controlla se la data inserita è in conflitto con la prima prenotazione futura)
        if (formData.returnDate) {
          // Escludi la prenotazione che si sta per iniziare (solo se selectedBooking esiste).
          const excludeBookingId = selectedBooking?.id || null;
          const otherBookings = bookings.filter(
            (b) => b.id !== excludeBookingId
          );

          const conflictMessage = checkBookingConflict(
            selectedVehicle.id,
            new Date().toISOString(), // Inizio Adesso
            formData.returnDate,
            otherBookings, // Usa la lista filtrata
            null,
            selectedVehicle.status,
            selectedVehicle.returnDateExpected
          );

          if (conflictMessage) {
            showToast(
              `Errore di Sovrapposizione: La riconsegna prevista per il ${formatDate(
                formData.returnDate
              )} entra in conflitto con una prenotazione esistente. Modifica la data o la prenotazione.`,
              "error"
            );
            return;
          }
        }
      }
      // Validazione Rientro Previsto per Mezzo Impegnato Senza data (usando l'escamotage 2099)
      else if (
        selectedVehicle.status === "impegnato" &&
        !selectedVehicle.returnDateExpected
      ) {
        showToast(
          `Errore: Impossibile consegnare un mezzo impegnato senza una Data di Rientro Prevista. Inserisci una data o modifica i dati del veicolo.`,
          "error"
        );
        return;
      }

      // Punto 6: Blocca se in riparazione
      if (selectedVehicle.isUnderRepair || selectedVehicle.isUnderMaintenance) {
        showToast(
          `ERRORE: Impossibile consegnare. Il veicolo è attualmente in manutenzione.`,
          "error"
        );
        return;
      }
    }

    try {
      let tripId = selectedVehicle.currentTripId || null;

      if (modalMode === "checkout") {
        // Genera il nuovo ID solo al Ritiro
        tripId = await getNextTripId(db);
      }

      const safeTripId = tripId || "N/A";

      // --- LOGICA GESTIONE DANNI PERSISTENTI ---

      const vehiclePersistentDamages = safeArray(
        selectedVehicle.persistentDamages
      );
      const vehicleDamagePhotos = safeArray(selectedVehicle.damagePhotos);
      const vehicleMissingChecklist = safeArray(
        selectedVehicle.missingChecklistItems
      );

      // Danni e foto registrati dall'utente in questo log
      const newDamagesEntry = (formData.damages || "").trim();
      const newDamagePhotos = safeArray(damagePhotos); // Foto caricate ora nel form

      // Dati che aggiornano il record veicolo
      const newPersistentDamages = [...vehiclePersistentDamages];
      const newDamagePhotosSet = new Set(vehicleDamagePhotos);

      // *** FIX CRITICO P.4 & 5: Registriamo il danno solo se la descrizione non è vuota O ci sono foto ***
      const hasNewDamageInfo =
        newDamagesEntry.length > 0 || newDamagePhotos.length > 0;

      if (hasNewDamageInfo) {
        // Aggiungiamo il nuovo danno all'array persistente
        newPersistentDamages.push({
          tripId: safeTripId,
          description: newDamagesEntry || "Danno non descritto, vedi foto.",
        });
        // Aggiorniamo il set delle foto persistenti sul veicolo (somma vecchie + nuove)
        newDamagePhotos.forEach((photo: string) =>
          newDamagePhotosSet.add(photo)
        );
      }

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
        damages: newDamagesEntry, // Danni registrati in questo log (Nuovi Danni/Danni Consegna)
        checklist,

        // Foto separate:
        signalingPhotos: signalingPhotos, // Foto Segnalazioni (solo log)
        newDamagePhotos: newDamagePhotos, // Foto Danni (Log correnti)

        // Danni Preesistenti AL MOMENTO del Log (per referenza storica)
        persistentDamages: vehiclePersistentDamages,

        signature,
        // Inclusione dell'URL immagine veicolo per il PDF!
        imageUrl: selectedVehicle.imageUrl || null,
        // Data di riconsegna prevista (solo al checkout)
        returnDateExpected:
          modalMode === "checkout" ? formData.returnDate || null : null,
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

      // FIX PUNTO 2: La variabile deve essere inizializzata all'inizio
      let updatedMissingChecklist = vehicleMissingChecklist;

      // AGGIORNAMENTO DOTAZIONI MANCANTI
      if (modalMode === "checkin") {
        // Al rientro, calcola la lista di item mancanti e aggiorna il record veicolo
        updatedMissingChecklist = CHECKLIST_ITEMS.filter(
          (item) => !checklist[item.id]
        ).map((item) => item.id);
      }

      const newVehicleData: any = {
        status: newStatus,
        driver: modalMode === "checkout" ? formData.driver : null,
        km: parseInt(formData.km) || selectedVehicle.km,
        fuel: formData.fuel,
        currentTripId: modalMode === "checkout" ? tripId : null,
        commessa: modalMode === "checkout" ? formData.commessa : null,
        // Aggiorna il campo rientro previsto solo al checkout
        returnDateExpected:
          modalMode === "checkout" ? formData.returnDate || null : null,

        // AGGIORNAMENTO DOTAZIONI MANCANTI
        missingChecklistItems: updatedMissingChecklist,

        // AGGIORNAMENTO DANNI PREESISTENTI SUL VEICOLO
        // Aggiorna l'array di oggetti danni con i nuovi (sommati)
        persistentDamages: newPersistentDamages,
        // Aggiorna il set totale delle foto persistenti sul veicolo
        damagePhotos: Array.from(newDamagePhotosSet),

        // Manteniamo lo stato di Riparazione/Manutenzione
        isUnderRepair: selectedVehicle.isUnderRepair,
        isUnderMaintenance: selectedVehicle.isUnderMaintenance,
      };

      await updateDoc(vehicleRef, newVehicleData);

      // Aggiunge il log
      await addDoc(
        collection(db, "artifacts", appId, "public", "data", "logs"),
        logData
      );

      // LOGICA AGGIUNTIVA: CANCELLA PRENOTAZIONE AL RIENTRO (CHECKIN)
      if (modalMode === "checkin") {
        const bookingIdToDelete = selectedVehicle.currentBookingId;
        if (bookingIdToDelete) {
          // CANCELLA la prenotazione che è stata soddisfatta
          await deleteDoc(getPublicDocRef("bookings", bookingIdToDelete));
          // Rimuovi l'associazione al veicolo (che è già fatto in updateDoc: currentBookingId: null)
          showToast(
            `Rientro completato e prenotazione ${bookingIdToDelete} cancellata.`,
            "success"
          );
        }
      }

      // LOGICA AGGIUNTIVA: ASSOCIA PRENOTAZIONE ALLA CONSEGNA
      if (modalMode === "checkout" && selectedBooking) {
        // Se la consegna è partita da una prenotazione, associa la prenotazione al veicolo
        await updateDoc(vehicleRef, { currentBookingId: selectedBooking.id });
      }

      closeModal();

      // CHIAMATA PER SCARICARE IL PDF SUBITO DOPO IL SALVATAGGIO (Punto 1)
      showToast(
        `${type} completata con successo! Download del Verbale in corso...`,
        "success"
      );
      generatePDF(logData);
    } catch (err) {
      // *** FIX ERRORE TRANSAZIONE: Logga l'errore per il debugging. ***
      console.error("ERRORE DURANTE updateDoc:", err);
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
        trips[tid] = [];
      }
      trips[tid].push(log);
    });

    // Processamento per la riga singola (simile a renderHistory ma per l'export)
    const aggregatedTrips = Object.keys(trips).map((tripId) => {
      // Ordina per data (Consegna prima di Rientro)
      const logsInTrip = trips[tripId].sort(
        (a: any, b: any) =>
          new Date(a.date).getTime() - new Date(b.date).getTime()
      );

      const consegna = logsInTrip.find((l: any) => l.type === "Consegna");
      const rientro = logsInTrip.find((l: any) => l.type === "Rientro");
      const refLog = rientro || consegna || logsInTrip[0];

      const tripOutput: any = {
        "Trip ID": `#${tripId || "N/A"}`,
        "Modello Veicolo": refLog.vehicleModel,
        Targa: refLog.plate,
        Commessa: refLog.commessa || "N/A",

        "Data CONSEGNA": consegna ? formatDate(consegna.date) : "",
        "Driver CONSEGNA": consegna ? consegna.driver || "N/A" : "",
        "Km CONSEGNA": consegna ? consegna.km : "",
        "Fuel CONSEGNA": consegna ? consegna.fuel : "",
        "Danni CONSEGNA": consegna ? consegna.damages || "" : "",
        "Note CONSEGNA": consegna ? consegna.notes || "" : "",

        "Data RIENTRO": rientro ? formatDate(rientro.date) : "",
        "Driver RIENTRO": rientro ? rientro.driver || "N/A" : "",
        "Km RIENTRO": rientro ? rientro.km : "",
        "Fuel RIENTRO": rientro ? rientro.fuel : "",
        "Danni RIENTRO": rientro ? rientro.damages || "" : "",
        "Note RIENTRO": rientro ? rientro.notes || "" : "",

        // La checklist è sempre l'ultima disponibile (rientro se c'è, altrimenti consegna)
      };

      const checklistSource = rientro || consegna;
      CHECKLIST_ITEMS.forEach((item) => {
        tripOutput[`Dotazione ${item.label}`] = checklistSource?.checklist?.[
          item.id
        ]
          ? "SI"
          : "NO";
      });

      return tripOutput;
    });

    if (aggregatedTrips.length === 0) {
      showToast("Nessun dato aggregato da esportare.", "error");
      return;
    }

    // Separatore: Punto e Virgola (;) per compatibilità EU Excel
    const SEPARATOR = ";";

    // Intestazioni (uso le chiavi del primo oggetto, garantendo l'ordine)
    const headers = Object.keys(aggregatedTrips[0]);

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

      return headers
        .map((header) => {
          const value = trip[header];
          // Applica cleanExcelValue solo ai campi numerici o che possono essere confusi con frazioni
          if (header.includes("Km") || header.includes("Fuel")) {
            return cleanExcelValue(value);
          }
          return cleanAndQuote(value);
        })
        .join(SEPARATOR);
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
              // Usa lo stato locale `checklist` che è inizializzato a true per default
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

  // RENDER SEZIONE DANNI PREESISTENTI (Sola lettura per il driver in Consegna/Rientro)
  const renderPersistentDamages = (vehicle: any, isConsegna: boolean) => {
    // FIX V87: Usiamo safeArray per garantire che i dati siano array
    const damages = safeArray(vehicle.persistentDamages);
    if (!vehicle || damages.length === 0) return null;

    return (
      <div className="border border-red-200 rounded-lg p-3 bg-red-50 space-y-2">
        <h4 className="text-sm font-bold text-red-700 flex items-center gap-1">
          <ShieldAlert className="w-4 h-4" /> Danni Preesistenti sul Veicolo
        </h4>

        {damages.map((damage: any, index: number) => (
          <div
            key={index}
            className="text-sm text-red-800 border-l-2 border-red-500 pl-2"
          >
            <p className="font-semibold text-xs">Trip ID: #{damage.tripId}</p>
            <p className="text-xs">{damage.description}</p>
          </div>
        ))}

        {/* Visualizzazione Foto Danni Preesistenti */}
        {safeArray(vehicle.damagePhotos).length > 0 && (
          <div className="pt-2">
            <p className="text-xs font-semibold text-red-700 mb-1">
              Foto Danni:
            </p>
            <div className="flex flex-wrap gap-2">
              {safeArray(vehicle.damagePhotos).map(
                (photo: string, idx: number) => (
                  <div
                    key={idx}
                    className="w-12 h-12 rounded overflow-hidden border border-red-300"
                  >
                    <img
                      src={photo}
                      alt={`Danno ${idx}`}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderDamageInputs = (
    isConsegna: boolean,
    onShowToast: (msg: string, type: string) => void
  ) => {
    const isEditing = modalMode === "editLog";

    const isVisible = isEditing || isConsegna || modalMode === "checkin";

    if (!isVisible) return null;

    // Titolo dinamico
    const inputLabel = isEditing
      ? "Danni / Anomalie (Revisione)"
      : "Descrizione Danni";

    const placeholderText = isEditing
      ? "Descrivi eventuali correzioni o anomalie..."
      : isConsegna
      ? "Segnala graffi o danni già presenti..."
      : "Descrivi chiaramente eventuali nuovi danni o anomalie riscontrate...";

    return (
      <>
        {/* 1. CAMPO DANNI */}
        <div className="bg-red-50 p-3 rounded-lg border border-red-100">
          <label className="text-sm font-bold text-red-700 flex items-center gap-1 mb-2">
            <AlertTriangle className="w-4 h-4" /> {inputLabel}
          </label>
          <textarea
            className="w-full p-2 border border-red-200 rounded-lg bg-white text-sm focus:ring-2 focus:ring-red-500 outline-none"
            rows={2}
            value={formData.damages || ""}
            onChange={(e) =>
              setFormData({ ...formData, damages: e.target.value })
            }
            placeholder={placeholderText}
          />
        </div>

        {/* 2. FOTO DANNI (Persistenti) */}
        <DamagePhotoUpload
          photos={damagePhotos}
          setPhotos={setDamagePhotos}
          onShowToast={onShowToast}
          label="Foto Danni"
        />

        {/* 3. CAMPO SEGNALAZIONI */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Segnalazioni Generiche
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

        {/* 4. FOTO SEGNALAZIONI (Solo Log) */}
        <DamagePhotoUpload
          photos={signalingPhotos}
          setPhotos={setSignalingPhotos}
          onShowToast={onShowToast}
          label="Foto Segnalazioni Generiche"
        />
      </>
    );
  };

  const renderModal = () => {
    if (!modalMode || modalMode === "editLog") return null; // Non renderizza qui se è editLog
    const isConsegna = modalMode === "checkout";
    const isEdit = modalMode === "edit";
    const isAdd = modalMode === "add";
    const isBook = modalMode === "book";
    const isEditBook = modalMode === "editBook";

    // Nomi movimenti nel titolo della modale
    const movementName = isConsegna ? "Consegna" : "Rientro";

    // Determina la firma da mostrare nel piccolo box di anteprima
    const currentSignature =
      signature || (modalMode === "editLog" ? selectedLog?.signature : null);

    const vehicleRef =
      selectedVehicle ||
      vehicles.find((v) => v.id === selectedBooking?.vehicleId);

    // Controlla se il campo Rientro Previsto è obbligatorio
    const isReturnDateRequired =
      !selectedBooking && hasFutureBookings(selectedVehicle?.id);

    const title = isAdd
      ? "Nuovo Mezzo"
      : isEdit
      ? `Modifica Veicolo: ${vehicleRef?.model}`
      : isBook
      ? `Prenota Veicolo: ${vehicleRef?.model}`
      : isEditBook
      ? `Modifica Prenotazione: ${vehicleRef?.model}`
      : `${movementName}: ${vehicleRef?.model}`;

    return (
      <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm">
        <div className="flex min-h-full items-center justify-center p-4 text-center">
          {/* MODIFICATO: rimosso il max-w su tutti i breakpoint per permettere l'espansione massima sul mobile */}
          <Card className="w-full sm:max-w-full md:max-w-xl transform text-left align-middle transition-all overflow-y-auto max-h-[90vh]">
            <div className="p-6">
              <div className="flex justify-between items-start border-b pb-4 mb-4 sticky top-0 bg-white z-10">
                <h3 className="text-xl font-extrabold text-gray-700 flex items-center gap-3">
                  {isAdd && <Plus className="w-5 h-5 text-orange-600" />}
                  {isEdit && <Pencil className="w-5 h-5 text-blue-600" />}
                  {(isBook || isEditBook) && (
                    <Calendar className="w-5 h-5 text-purple-600" />
                  )}
                  {/* Il pulsante Consegna è stato spostato sul rosso, quindi l'icona qui è coerente */}
                  {isConsegna && (
                    <ArrowRight className="w-5 h-5 text-red-600" />
                  )}
                  {!isConsegna &&
                    !isAdd &&
                    !isEdit &&
                    !(isBook || isEditBook) && (
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    )}

                  {title}
                </h3>
                <button
                  type="button"
                  onClick={closeModal}
                  className="p-1 rounded-full hover:bg-gray-100 text-gray-500 hover:text-gray-900"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* MODULO PRENOTAZIONE (NUOVA O MODIFICA) */}
              {isBook || isEditBook ? (
                <form
                  onSubmit={isBook ? handleBooking : handleEditBooking}
                  className="space-y-4"
                >
                  <p className="text-sm text-gray-600 border-l-4 border-purple-400 pl-3 py-1 bg-purple-50 rounded-r-lg">
                    {isBook
                      ? `Registrazione di una prenotazione futura per ${vehicleRef?.model} (${vehicleRef?.plate}).`
                      : `Modifica prenotazione per ${vehicleRef?.model} (${vehicleRef?.plate}) - Driver originale: ${selectedBooking?.driver}`}
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Nome e Cognome (Prenotazione)
                      </label>
                      <input
                        className="w-full border p-3 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                        placeholder="Nome Driver Prenotato"
                        value={formData.reservationDriver || ""}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            reservationDriver: e.target.value,
                          })
                        }
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Commessa (Opzionale)
                      </label>
                      <input
                        className="w-full border p-3 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                        placeholder="Es. 23-050"
                        value={formData.reservationCommessa || ""}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            reservationCommessa: e.target.value,
                          })
                        }
                      />
                    </div>
                  </div>
                  {/* Punti 3: Aggiunto input per data Rientro Presunta */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Data e Ora di Ritiro (Presunta)
                      </label>
                      <input
                        type="datetime-local"
                        className="w-full border p-3 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                        value={
                          formData.reservationDateStart || formatDateTimeLocal()
                        }
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            reservationDateStart: e.target.value,
                          })
                        }
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Data e Ora di Rientro (Presunta)
                      </label>
                      <input
                        type="datetime-local"
                        className="w-full border p-3 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                        value={
                          formData.reservationDateEnd || formatDateTimeLocal()
                        }
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            reservationDateEnd: e.target.value,
                          })
                        }
                        required
                      />
                    </div>
                  </div>

                  <div className="flex gap-3 pt-4 sticky bottom-0 bg-white border-t pt-4">
                    <Button
                      variant="secondary"
                      onClick={closeModal}
                      className="w-auto"
                    >
                      Annulla
                    </Button>
                    <Button variant="booking" type="submit" className="w-auto">
                      <Plus className="w-5 h-5" />{" "}
                      {isBook ? "Prenota" : "Aggiorna Prenotazione"}
                    </Button>
                  </div>
                </form>
              ) : // MODULO AGGIUNTA o MODIFICA VEICOLO O MOVIMENTI
              isAdd || isEdit ? (
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

                  {/* Danni Preesistenti (Sola lettura per il driver) */}
                  {renderPersistentDamages(selectedVehicle, isConsegna)}

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
                    <div className="md:col-span-2 space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Commessa (Opzionale)
                        </label>
                        <input
                          className="w-full border p-3 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
                          placeholder="Es. 23-050"
                          value={formData.commessa || ""}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              commessa: e.target.value,
                            })
                          }
                        />
                      </div>
                      {/* CAMPO: Data Riconsegna Prevista (Punto 6) */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                          <Clock className="w-4 h-4 text-gray-500" /> Rientro
                          Previsto{" "}
                          {selectedBooking
                            ? "(Da Prenotazione)"
                            : hasFutureBookings(selectedVehicle?.id)
                            ? "(Obbligatorio)"
                            : "(Opzionale)"}
                        </label>
                        <input
                          type="datetime-local"
                          className="w-full border p-3 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
                          value={formData.returnDate || ""}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              returnDate: e.target.value,
                            })
                          }
                          // RIMOSSO REQUIRED HTML - Ora gestito dal codice JS
                        />
                        <p className="text-[10px] text-gray-400 mt-1">
                          Se specificato, verrà usato per controllare i
                          conflitti con prenotazioni future.
                        </p>
                      </div>
                    </div>
                  )}

                  {renderFuelSelector()}
                  {renderChecklist()}

                  {/* Input per Nuovi Danni (solo Rientro/Modifica Log) e Foto Danni/Segnalazioni */}
                  {renderDamageInputs(isConsegna, showToast)}

                  {/* SEZIONE FIRMA STANDARD (Modale unica) */}
                  <div className="md:col-span-full">
                    <SignaturePad
                      onSave={handleSignatureSave}
                      label="Firma Driver per Accettazione"
                      setFormData={setFormData}
                      initialSignature={signature || selectedVehicle?.signature}
                      modalMode={modalMode}
                      disclaimer={isConsegna ? DAMAGE_DISCLAIMER : null}
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
                    {/* Testo aggiornato (Punto 3) */}
                    <Button
                      type="submit"
                      loading={generatingPdf}
                      disabled={generatingPdf || !signature}
                      className="w-auto"
                    >
                      {`Conferma ${movementName}`}
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

    // Recupera il veicolo per i danni persistenti (necessario solo per il rendering se stiamo editando un log)
    const vehicle = vehicles.find((v) => v.id === selectedLog.vehicleId);

    // ... Logica di rendering Modifica Log
    return (
      <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm">
        <div className="flex min-h-full items-center justify-center p-4 text-center">
          {/* Rimosso max-w per l'espansione della firma */}
          <Card className="w-full sm:max-w-full md:max-w-xl transform text-left align-middle transition-all overflow-y-auto max-h-[90vh]">
            <div className="p-6">
              <div className="flex justify-between items-start border-b pb-4 mb-4 sticky top-0 bg-white z-10">
                <h3 className="text-xl font-extrabold text-gray-700 flex items-center gap-3">
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

                {/* Danni Persistenti del veicolo al momento del log (solo visualizzazione) */}
                {renderPersistentDamages(
                  vehicle,
                  selectedLog.type === "Consegna"
                )}

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

                {/* Input per Nuovi Danni (solo Rientro/Modifica Log) e Foto Danni/Segnalazioni */}
                {renderDamageInputs(selectedLog.type === "Consegna", showToast)}

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

                {/* PhotoUpload e DamagePhotoUpload già caricano i dati nello stato nel openLogModal */}

                {/* SEZIONE FIRMA STANDARD (Modale unica) */}
                <div className="md:col-span-full">
                  <SignaturePad
                    onSave={handleSignatureSave}
                    label="Firma di Revisione/Conferma"
                    setFormData={setFormData}
                    initialSignature={signature || selectedLog?.signature}
                    modalMode={modalMode}
                    disclaimer={DAMAGE_DISCLAIMER}
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

  const renderBookingsPage = () => {
    const now = new Date().getTime();

    // 1. Dati Prenotazioni Future (quelle create dagli utenti)
    const futureBookings = bookings
      .filter((b) => new Date(b.returnDate || b.date).getTime() > now) // Filtra solo quelle future
      .map((b) => ({ ...b, type: "BOOKING" }));

    // 2. Dati Mezzi Fuori (Non da Prenotazione con Data Rientro Prevista)
    const nonBookedEngagedVehicles = vehicles
      // Includi SOLO mezzi impegnati SENZA prenotazione associata E con un RIENTRO PREVISTO NON NULLO (non fittizio)
      .filter(
        (v) =>
          v.status === "impegnato" &&
          !v.currentBookingId &&
          v.returnDateExpected &&
          v.returnDateExpected !== FAR_FUTURE_DATE
      )
      .map((v) => {
        // Trova l'ultimo log di consegna per i dettagli
        const lastConsegna = logs.find(
          (l) => l.vehicleId === v.id && l.type === "Consegna"
        );

        return {
          id: v.id,
          type: "NON_BOOKED_OUT",
          vehicleId: v.id,
          vehicleModel: v.model,
          plate: v.plate,
          driver: v.driver,
          commessa: v.commessa,
          // Data Ritiro Reale (dal Log)
          date: lastConsegna?.date || new Date().toISOString(),
          // Data Rientro Prevista (dal Veicolo)
          returnDate: v.returnDateExpected,
        };
      });

    // 3. Unisci e Ordina (per data di ritiro/consegna)
    const allActiveTrips = [
      ...futureBookings,
      ...nonBookedEngagedVehicles,
    ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-extrabold text-gray-700 flex items-center gap-2">
          <BookOpen className="w-6 h-6 text-purple-600" /> Calendario
          Prenotazioni e Mezzi Fuori
        </h2>

        {allActiveTrips.length === 0 ? (
          <div className="text-center py-12 text-gray-500 bg-white rounded-xl shadow-sm border border-gray-100">
            <Calendar className="w-10 h-10 mx-auto mb-3 text-gray-400" />
            <p>Nessun mezzo fuori o prenotazione attiva registrata.</p>
          </div>
        ) : (
          <Card>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Veicolo
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Driver / Commessa
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Ritiro/Consegna
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Rientro Previsto
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Azioni
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {allActiveTrips.map((b: any) => {
                    const vehicle = vehicles.find((v) => v.id === b.vehicleId);
                    const isBooking = b.type === "BOOKING";
                    const isCheckedOutToThisBooking =
                      isBooking && vehicle?.currentBookingId === b.id;
                    const isNonBookedOut = b.type === "NON_BOOKED_OUT";

                    return (
                      <tr key={b.id + b.type} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {b.vehicleModel} ({b.plate})
                          {isNonBookedOut && (
                            <span className="ml-2 text-[10px] font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded-full">
                              NON DA PRENOTAZIONE
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                          {b.driver}
                          <br />
                          <span className="text-xs text-gray-500">
                            Commessa: {b.commessa || "N/A"}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                          {formatDate(b.date)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                          {formatDate(b.returnDate)}
                          {isNonBookedOut && (
                            <p className="text-xs text-red-500">
                              (Rientro Previsto)
                            </p>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex justify-end gap-2">
                            {isBooking && (
                              <>
                                {/* Pulsante Consegna (Checkout) da Prenotazione */}
                                <button
                                  onClick={() => openModal("book_checkout", b)}
                                  className={`p-2 rounded-full transition-colors ${
                                    isCheckedOutToThisBooking ||
                                    vehicle?.status !== "disponibile"
                                      ? "text-gray-400 cursor-not-allowed"
                                      : "text-red-600 hover:text-red-900 hover:bg-red-50"
                                  }`}
                                  title={
                                    isCheckedOutToThisBooking
                                      ? "Consegna già avviata"
                                      : vehicle?.status !== "disponibile"
                                      ? "Veicolo in uso"
                                      : "Inizia Consegna (Checkout)"
                                  }
                                  disabled={
                                    isCheckedOutToThisBooking ||
                                    vehicle?.status !== "disponibile"
                                  }
                                >
                                  <ArrowRight className="w-4 h-4" />
                                </button>
                                {/* Pulsante Modifica Prenotazione */}
                                <button
                                  onClick={() => openModal("editBook", b)}
                                  className="text-purple-600 hover:text-purple-900 p-2 rounded-full hover:bg-purple-50 transition-colors"
                                  title="Modifica Prenotazione"
                                >
                                  <Pencil className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => deleteBooking(b.id)}
                                  className="text-red-600 hover:text-red-900 p-2 rounded-full hover:bg-red-50 transition-colors"
                                  title="Cancella Prenotazione"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </>
                            )}
                            {isNonBookedOut && (
                              <span className="text-gray-500 text-xs py-2 px-3">
                                Solo Visualizzazione
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>
    );
  };

  const renderDamagePage = () => {
    // Filtra solo i veicoli che hanno danni persistenti
    const damagedVehicles = vehicles.filter(
      (v) => hasPersistentDamages(v) || v.isUnderRepair || v.isUnderMaintenance
    );

    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-extrabold text-gray-700 flex items-center gap-2">
          <Wrench className="w-6 h-6 text-red-600" /> Gestione Danni
        </h2>

        {damagedVehicles.length === 0 ? (
          <div className="text-center py-12 text-gray-500 bg-white rounded-xl shadow-sm border border-gray-100">
            <CheckCircle className="w-10 h-10 mx-auto mb-3 text-green-600" />
            <p>Nessun veicolo con danni persistenti o in manutenzione.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {damagedVehicles.map((v) => {
              const isCurrentlyUnderRepair =
                v.status === "manutenzione" && v.isUnderRepair;
              const isCurrentlyUnderMaintenance =
                v.status === "manutenzione" && v.isUnderMaintenance;

              // Stato pulsanti
              const repairDisabled =
                v.status !== "disponibile" && !isCurrentlyUnderRepair;
              const maintenanceDisabled =
                v.status !== "disponibile" && !isCurrentlyUnderMaintenance;

              // FIX: Solo Ripristino (Riparazione Danni) rimane
              const buttonTextRipristino = isCurrentlyUnderRepair
                ? "Termina Ripristino"
                : "Inizia Ripristino";
              const buttonTextManutenzione = isCurrentlyUnderMaintenance
                ? "Termina Manutenzione"
                : "Inizia Manutenzione";

              return (
                <Card key={v.id} className="p-4 space-y-4">
                  <div className="flex justify-between items-start border-b pb-3 mb-3">
                    <div className="flex items-center gap-3">
                      <h3 className="text-xl font-bold text-gray-900">
                        {v.model}
                      </h3>
                      <Badge
                        status={v.status}
                        isUnderRepair={v.isUnderRepair}
                        isUnderMaintenance={v.isUnderMaintenance}
                      />
                    </div>
                    <p className="text-sm font-mono text-gray-600">{v.plate}</p>
                  </div>

                  {/* Danni Dettagliati */}
                  {safeArray(v.persistentDamages).length > 0 && (
                    <div className="space-y-3">
                      <h4 className="text-sm font-semibold text-red-700">
                        Danni Registrati:
                      </h4>
                      {safeArray(v.persistentDamages).map(
                        (damage: any, index: number) => (
                          <div
                            key={index}
                            className="border-l-4 border-red-400 pl-3"
                          >
                            <p className="font-semibold text-sm text-red-700">
                              Danno # {index + 1} (Trip ID: #{damage.tripId})
                            </p>
                            <p className="text-sm text-gray-700">
                              {damage.description}
                            </p>
                          </div>
                        )
                      )}
                    </div>
                  )}

                  {/* Foto Danni Preesistenti */}
                  {safeArray(v.damagePhotos).length > 0 && (
                    <div className="pt-2">
                      <p className="text-sm font-semibold text-red-700 mb-1">
                        Foto Documentazione:
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {safeArray(v.damagePhotos).map(
                          (photo: string, idx: number) => (
                            <div
                              key={idx}
                              className="w-16 h-16 rounded overflow-hidden border border-red-300"
                            >
                              <img
                                src={photo}
                                alt={`Danno ${idx}`}
                                className="w-full h-full object-cover"
                              />
                            </div>
                          )
                        )}
                      </div>
                    </div>
                  )}

                  <div className="pt-3 border-t grid grid-cols-2 gap-3">
                    {/* 1. PULSANTE RIPRISTINO (Cancella danni) */}
                    <Button
                      variant={isCurrentlyUnderRepair ? "success" : "admin"}
                      onClick={() =>
                        repairVehicle(
                          v,
                          isCurrentlyUnderRepair
                            ? "full_repair_end"
                            : "full_repair"
                        )
                      }
                      disabled={repairDisabled && !isCurrentlyUnderRepair}
                      title={
                        repairDisabled
                          ? "Mezzo non disponibile per iniziare il Ripristino."
                          : ""
                      }
                    >
                      {buttonTextRipristino}
                    </Button>

                    {/* 2. PULSANTE MANUTENZIONE (Non cancella danni) */}
                    {/* RIMOSSO QUESTO BLOCCO DALLA PAGINA DANNI - SOLO FLOTTA */}
                    {/* <Button 
                                        variant={isCurrentlyUnderMaintenance ? "success" : "maintenance"}
                                        onClick={() => repairVehicle(v, isCurrentlyUnderMaintenance ? 'end_maintenance' : 'start_maintenance')}
                                        disabled={maintenanceDisabled && !isCurrentlyUnderMaintenance}
                                        title={maintenanceDisabled ? "Mezzo non disponibile per iniziare la manutenzione." : ""}
                                    >
                                        {buttonTextManutenzione}
                                    </Button> */}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
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
            type="password" // CORRETTO: type="password" per nascondere il PIN
            placeholder="PIN"
            value={pinInput}
            onChange={(e) => setPinInput(e.target.value.toUpperCase())} // Legge e converte in maiuscolo
            className="w-full border p-3 rounded-lg text-center tracking-[0.5em] font-mono text-lg focus:ring-2 focus:ring-orange-500 outline-none uppercase"
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
    // Funzione helper per determinare se il veicolo ha una prenotazione attiva o futura (per il badge)
    const isVehicleBookedNow = (
      vehicleId: string,
      currentBookingId: string | null
    ) => {
      // Cerca se il veicolo ha UNA QUALSIERI prenotazione che non è ancora scaduta.
      const now = new Date().getTime();

      return bookings.some((b) => {
        if (
          b.vehicleId === vehicleId &&
          new Date(b.returnDate || b.date).getTime() > now
        ) {
          if (b.id === currentBookingId) {
            // E' la prenotazione in corso: mostriamo il badge solo se ci sono altre prenotazioni future
            return bookings.some(
              (otherB) =>
                otherB.vehicleId === vehicleId &&
                otherB.id !== currentBookingId &&
                new Date(otherB.returnDate || otherB.date).getTime() > now
            );
          }
          // E' una prenotazione futura
          return true;
        }
        return false;
      });
    };

    // Filtro e ricerca
    const filteredVehicles = vehicles.filter(
      (v) =>
        (v.model?.toLowerCase() || "").includes(
          searchDashboardTerm.toLowerCase()
        ) ||
        (v.plate?.toLowerCase() || "").includes(
          searchDashboardTerm.toLowerCase()
        ) ||
        (v.driver?.toLowerCase() || "").includes(
          searchDashboardTerm.toLowerCase()
        )
    );

    const available = vehicles.filter(
      (v) =>
        v.status === "disponibile" && !v.isUnderRepair && !v.isUnderMaintenance
    );
    const engaged = vehicles.filter((v) => v.status === "impegnato");
    const totalVehicles = vehicles.length; // Calcolo Totale Veicoli

    // Prenotazioni attive (solo quelle con rientro futuro o attuale)
    const activeBookings = bookings.filter(
      (b) => new Date(b.returnDate || b.date).getTime() > new Date().getTime()
    );
    const totalBookings = activeBookings.length;
    // Veicoli con danni persistenti
    const damagedVehicleCount = vehicles.filter(
      (v) => hasPersistentDamages(v) || v.isUnderRepair || v.isUnderMaintenance
    ).length;

    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-extrabold text-gray-700">
          Dashboard Flotta
        </h2>

        {/* Griglia Statistiche */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
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
          {/* Box Prenotazioni */}
          <Card className="p-4 flex items-center gap-4 bg-purple-50">
            <div className="bg-purple-600 p-3 rounded-full text-white">
              <Calendar className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Prenotati</p>{" "}
              {/* Testo aggiornato */}
              <strong className="text-3xl font-bold">{totalBookings}</strong>
            </div>
          </Card>
        </div>

        {/* Griglia Danni (Nuovo Box) */}
        {damagedVehicleCount > 0 && (
          <Card className={`p-4 space-y-3 border-red-300 bg-red-50`}>
            <h3 className="text-lg font-bold text-red-800 flex items-center justify-between gap-2">
              <span className="flex items-center gap-2">
                <Wrench className="w-5 h-5" /> Veicoli Danneggiati
              </span>
              <button
                onClick={() => setView("danni")}
                className="text-xs text-red-600 hover:text-red-800 flex items-center gap-1 transition-colors font-medium"
              >
                Vai a Riparazioni <ArrowRight className="w-3 h-3" />
              </button>
            </h3>
            <p className="text-sm text-gray-700">
              Ci sono {damagedVehicleCount} veicoli con danni persistenti che
              richiedono intervento.
            </p>
          </Card>
        )}

        {/* Visualizzazione Prossime Prenotazioni (Punto 3) */}
        <Card
          className={`p-4 space-y-3 ${
            totalBookings > 0
              ? "border-purple-300 bg-purple-50"
              : "border-gray-300 bg-white"
          }`}
        >
          <h3 className="text-lg font-bold text-purple-800 flex items-center gap-2">
            <Calendar className="w-5 h-5" /> Prossime Prenotazioni
          </h3>

          {totalBookings === 0 ? (
            <p className="text-sm text-gray-500">
              Nessuna prenotazione attiva o futura.
            </p>
          ) : (
            activeBookings
              .sort(
                (a, b) =>
                  new Date(a.date).getTime() - new Date(b.date).getTime()
              )
              .slice(0, 3)
              .map((b) => {
                // Trova lo stato del veicolo e controlla se la prenotazione è "In Corso"
                const vehicle = vehicles.find((v) => v.id === b.vehicleId);
                const isCheckedOutToThisBooking =
                  vehicle?.currentBookingId === b.id;

                // FIX P.1: Il pulsante Consegna è disabilitato se il veicolo è già in uso.
                const isConsegnaDisabled = vehicle?.status !== "disponibile";

                return (
                  <div
                    key={b.id}
                    className="text-sm text-purple-700 flex justify-between items-center"
                  >
                    <p>
                      {/* Aggiunto Marca e Modello (Punto 3) */}
                      <strong className="font-semibold">
                        {b.vehicleModel} ({b.plate})
                      </strong>{" "}
                      per {b.driver}
                      <span className="text-xs text-purple-600 ml-2">
                        ({formatDate(b.date)})
                      </span>
                    </p>
                    {isCheckedOutToThisBooking ? (
                      <BookingInUseBadge />
                    ) : (
                      // PULSANTE CONSEGNA DIRETTA (al posto di Inizia in)
                      <button
                        onClick={() => openModal("book_checkout", b)}
                        className={`text-xs font-medium flex items-center gap-1 ${
                          isConsegnaDisabled
                            ? "text-gray-400 cursor-not-allowed"
                            : "text-red-600 hover:text-red-800"
                        }`}
                        disabled={isConsegnaDisabled}
                        title={
                          isConsegnaDisabled
                            ? `Veicolo in uso da ${vehicle?.driver}`
                            : "Inizia Consegna (Checkout)"
                        }
                      >
                        <ArrowRight className="w-3 h-3" /> Consegna
                      </button>
                    )}
                  </div>
                );
              })
          )}
        </Card>

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
            {filteredVehicles.map((v) => {
              const isCurrentlyBooked = isVehicleBooked(
                v.id,
                v.currentBookingId
              );

              // Data rientro prevista per i mezzi in uso
              const expectedReturn =
                v.status === "impegnato" &&
                v.returnDateExpected &&
                v.returnDateExpected !== FAR_FUTURE_DATE
                  ? formatDate(v.returnDateExpected)
                  : null;

              // Check se prenotabile: Non prenotabile se impegnato E non ha data di rientro prevista
              const isBookable =
                v.status !== "impegnato" ||
                (v.status === "impegnato" &&
                  v.returnDateExpected &&
                  v.returnDateExpected !== FAR_FUTURE_DATE);

              return (
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
                      <div className="flex gap-1 items-center">
                        {v.persistentDamages?.length > 0 && <DamageBadge />}
                        {isCurrentlyBooked && <BookingBadge />}
                        <Badge
                          status={v.status}
                          isUnderRepair={v.isUnderRepair}
                          isUnderMaintenance={v.isUnderMaintenance}
                        />
                      </div>
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
                        <>
                          <p className="text-orange-700">
                            <User className="inline w-3 h-3 mr-1" />
                            <strong>Driver:</strong> {v.driver || "N/A"}{" "}
                            (Commessa: {v.commessa || "N/A"})
                          </p>
                          {/* Rientro Previsto (Punto 7) */}
                          {expectedReturn && (
                            <p className="text-red-700">
                              <Clock className="inline w-3 h-3 mr-1" />
                              <strong>Rientro Previsto:</strong>{" "}
                              {expectedReturn}
                            </p>
                          )}
                        </>
                      )}

                      {/* Pulsante Prenota sul veicolo */}
                      {isBookable ? (
                        <button
                          onClick={() => openModal("book", v)}
                          className="mt-2 text-xs font-medium text-purple-600 hover:text-purple-800 flex items-center gap-1 transition-colors"
                        >
                          <Calendar className="w-4 h-4" /> Prenota
                        </button>
                      ) : v.status === "impegnato" ? (
                        <p className="text-xs text-red-500 mt-2 flex items-center gap-1">
                          Non Prenotabile (Rientro Non Previsto)
                        </p>
                      ) : null}
                    </div>

                    <div className="mt-4 flex gap-3">
                      {/* Testo bottoni in Consegna/Rientro */}
                      {v.status === "disponibile" ? (
                        <Button
                          variant="primary" // Ora in rosso
                          className="text-sm py-2 px-3 flex-1 sm:flex-none"
                          onClick={() => openModal("checkout", v)}
                          disabled={v.isUnderRepair || v.isUnderMaintenance} // Non consegnabile se in riparazione o manutenzione
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
                          {v.isUnderRepair
                            ? "In Ripristino"
                            : "In Manutenzione"}
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const renderFleet = () => {
    const filteredVehicles = vehicles.filter(
      (v) =>
        (v.model?.toLowerCase() || "").includes(
          searchFleetTerm.toLowerCase()
        ) ||
        (v.plate?.toLowerCase() || "").includes(searchFleetTerm.toLowerCase())
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
                    Driver Corrente
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
                {filteredVehicles.map((v) => {
                  const nextBooking = bookings
                    .filter(
                      (b) =>
                        b.vehicleId === v.id &&
                        new Date(b.returnDate || b.date).getTime() >
                          new Date().getTime()
                    )
                    .sort(
                      (a, b) =>
                        new Date(a.date).getTime() - new Date(b.date).getTime()
                    )[0];

                  // Non prenotabile se impegnato E non ha data di rientro prevista
                  const isBookable =
                    v.status !== "impegnato" ||
                    (v.status === "impegnato" &&
                      v.returnDateExpected &&
                      v.returnDateExpected !== FAR_FUTURE_DATE);

                  return (
                    <tr
                      key={v.id}
                      className="group hover:bg-gray-50 transition-colors"
                    >
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
                          <div>
                            {v.model}
                            {nextBooking && (
                              <p className="text-[10px] text-purple-600 flex items-center gap-1 mt-0.5">
                                <Calendar className="w-3 h-3" /> Prenotato da{" "}
                                {nextBooking.driver} (
                                {formatShortDate(nextBooking.date)})
                              </p>
                            )}
                          </div>
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
                        <Badge
                          status={v.status}
                          isUnderRepair={v.isUnderRepair}
                          isUnderMaintenance={v.isUnderMaintenance}
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex justify-end gap-2">
                          {/* PULSANTE PRENOTA MEZZO IMPEGNATO (Punto 2) */}
                          {isBookable && (
                            <button
                              onClick={() => openModal("book", v)}
                              className="text-purple-600 hover:text-purple-900 p-2 rounded-full hover:bg-purple-50 transition-colors"
                              title="Prenota questo veicolo"
                            >
                              <Calendar className="w-4 h-4" />
                            </button>
                          )}
                          {!isBookable && v.status === "impegnato" && (
                            <span className="text-xs text-red-500 py-2">
                              Non Prenotabile
                            </span>
                          )}
                          {/* PULSANTE INIZIA/TERMINA MANUTENZIONE (Punto 3) */}
                          {(v.status === "disponibile" ||
                            v.isUnderMaintenance) && (
                            <button
                              onClick={() =>
                                repairVehicle(
                                  v,
                                  v.isUnderMaintenance
                                    ? "end_maintenance"
                                    : "start_maintenance"
                                )
                              }
                              className={`p-2 rounded-full transition-colors ${
                                v.isUnderMaintenance
                                  ? "text-green-600 hover:bg-green-50"
                                  : "text-blue-600 hover:bg-blue-50"
                              }`}
                              title={
                                v.isUnderMaintenance
                                  ? "Termina Manutenzione"
                                  : "Inizia Manutenzione"
                              }
                              disabled={v.isUnderRepair}
                            >
                              <Wrench className="w-4 h-4" />
                            </button>
                          )}

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
                            disabled={
                              v.status !== "disponibile" ||
                              v.isUnderRepair ||
                              v.isUnderMaintenance
                            } // Disabilita se in uso o in manutenzione
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
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
                  <div className="flex items-center gap-3">
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
                    {/* Pulsante Elimina Intero Trip */}
                    <button
                      onClick={() => deleteTrip(trip.tripId)}
                      className="text-red-500 hover:text-red-800 p-1 rounded-full hover:bg-red-50"
                      title="Elimina l'intero Trip (Ritiro + Riconsegna)"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
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

    // Nuovo Listener per le Prenotazioni (Ordina per data più vicina)
    const qBookings = query(
      getPublicCollectionPath("bookings"),
      orderBy("date", "asc")
    );
    const unsubBookings = onSnapshot(
      qBookings,
      (snapshot) => {
        const bList = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setBookings(bList);
      },
      (err) => console.error("Error bookings:", err)
    );

    return () => {
      unsubVehicles();
      unsubLogs();
      unsubBookings(); // Cleanup nuovo listener
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
  // AGGIUNTO 'bookings' e 'danni' alla lista delle viste
  const availableViews = [
    "dashboard",
    "flotta",
    "storico",
    "bookings",
    "danni",
  ];

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
              {t === "bookings" ? "Prenotazioni" : t === "danni" ? "Danni" : t}
            </button>
          ))}
        </nav>
        <main className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          {view === "dashboard" && renderDashboard()}
          {view === "flotta" && renderFleet()}
          {view === "storico" && renderHistory()}
          {view === "bookings" && renderBookingsPage()}
          {view === "danni" && renderDamagePage()}
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
