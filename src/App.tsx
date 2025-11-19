import React, { useState, useRef, useEffect } from "react";
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
} from "firebase/firestore";

// Definizioni per TypeScript
declare global {
  interface Window {
    emailjs: any;
    jspdf: any;
  }
}

// INTERFACCIA TOAST (MODIFICATA PER EVITARE ERRORI DI BUILD)
// Il '?' dopo type rende la proprietà opzionale.
interface ToastState {
  visible: boolean;
  message: string;
  type?: "success" | "error" | string;
}

// --- CONFIGURAZIONE FIREBASE ---
const firebaseConfig = {
  apiKey: "AIzaSyCZTaNfYTeqKaWKOnf-dqQsBFwL4pZHQfM",
  authDomain: "gestione-flotta-pool.firebaseapp.com",
  projectId: "gestione-flotta-pool",
  storageBucket: "gestione-flotta-pool.firebasestorage.app",
  messagingSenderId: "86851688702",
  appId: "1:86851688702:web:1cff896b5909a26ada2daf",
};

// Inizializzazione standard
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = "flotta-renco-v1";

// --- CONFIGURAZIONE EMAIL (EMAILJS) ---
const EMAILJS_CONFIG = {
  SERVICE_ID: "",
  TEMPLATE_ID: "",
  PUBLIC_KEY: "",
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
  const counterRef = doc(
    dbInstance,
    "artifacts",
    appId,
    "public",
    "data",
    "counters",
    "trips"
  );
  try {
    const newId = await runTransaction(dbInstance, async (transaction: any) => {
      const counterDoc = await transaction.get(counterRef);
      let currentCount = 0;
      if (counterDoc.exists()) {
        currentCount = counterDoc.data().count || 0;
      }
      const nextCount = currentCount + 1;
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

// --- COMPONENTI SPECIALI ---

const SignaturePad = ({ onSave, label, disclaimer }: any) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);

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
    setHasSignature(true);
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

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.width = canvas.offsetWidth;
      canvas.height = 150;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.strokeStyle = "#000";
        ctx.lineWidth = 2;
        ctx.lineCap = "round";
      }
    }
  }, []);

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
          className="text-xs text-red-600 hover:underline"
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

const PhotoUpload = ({ photos, setPhotos }: any) => {
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
        alert("Impossibile caricare l'immagine.");
      } finally {
        setCompressing(false);
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
            />
            <button
              type="button"
              onClick={() => removePhoto(idx)}
              className="absolute top-0 right-0 bg-red-500 text-white p-0.5 rounded-bl opacity-0 group-hover:opacity-100 transition-opacity"
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
  { id: "manuale", label: "Manuale Uso e Manutenzione" },
  { id: "giubbino", label: "Giubbino Catarifrangente" },
  { id: "triangolo", label: "Triangolo" },
];

const FUEL_LEVELS = ["Riserva", "1/4", "1/2", "3/4", "Pieno"];

const App = () => {
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

  // NOTA: 'type' ora è opzionale nella definizione dello stato, così typescript non si blocca se manca.
  const [toast, setToast] = useState<ToastState>({
    visible: false,
    message: "",
    type: "success",
  });

  const [generatingPdf, setGeneratingPdf] = useState(false);

  useEffect(() => {
    loadExternalScripts();
    const initAuth = async () => {
      if (auth) {
        try {
          await signInAnonymously(auth);
        } catch (error: any) {
          console.error("Auth Error:", error);
          setToast({
            visible: true,
            message: "Errore Autenticazione Anonima.",
            type: "error",
          });
        }
      }
    };
    initAuth();
    if (auth) {
      const unsubscribe = onAuthStateChanged(auth, (u) => setUser(u));
      return () => unsubscribe();
    }
  }, []);

  useEffect(() => {
    if (!user || !db) return;
    const qVehicles = query(
      collection(db, "artifacts", appId, "public", "data", "vehicles")
    );
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
        if (err.code === "permission-denied") setPermissionError(true);
      }
    );

    const qLogs = query(
      collection(db, "artifacts", appId, "public", "data", "logs")
    );
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
  }, [user]);

  // --- PDF GENERATION ---
  const generatePDF = (logData: any) => {
    if (!window.jspdf) {
      alert("Libreria PDF non ancora caricata. Riprova tra qualche secondo.");
      return;
    }
    setGeneratingPdf(true);
    try {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.width;

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

      doc.setTextColor(0, 0, 0);
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text(`VERBALE DI ${logData.type.toUpperCase()}`, 14, 40);

      doc.setFontSize(12);
      doc.setTextColor(234, 88, 12);
      doc.text(`Trip ID: #${logData.tripId || "N/A"}`, pageWidth - 60, 40);

      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text(`Data: ${new Date(logData.date).toLocaleString()}`, 14, 46);

      doc.setDrawColor(200, 200, 200);
      doc.setFillColor(250, 250, 250);
      doc.rect(14, 55, pageWidth - 28, 35, "FD");
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(11);
      doc.text("VEICOLO", 20, 65);
      doc.setFont("helvetica", "normal");
      doc.text(`${logData.vehicleModel}`, 20, 72);
      doc.setFont("helvetica", "bold");
      doc.text(`${logData.plate}`, 20, 78);

      doc.text("ASSEGNATARIO", 100, 65);
      doc.setFont("helvetica", "normal");
      doc.text(`${logData.driver}`, 100, 72);
      // Commessa
      if (logData.commessa) doc.text(`Commessa: ${logData.commessa}`, 100, 78);

      doc.setFont("helvetica", "bold");
      doc.text("KM RILEVATI", 160, 65);
      doc.setFont("helvetica", "normal");
      doc.text(`${logData.km} km`, 160, 72);
      doc.text(`Fuel: ${logData.fuel}`, 160, 78);

      let yPos = 105;
      if (logData.checklist) {
        doc.setFont("helvetica", "bold");
        doc.text("DOTAZIONI E DOCUMENTI", 14, yPos);
        yPos += 8;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        const items = CHECKLIST_ITEMS;
        items.forEach((item, index) => {
          const isPresent = logData.checklist[item.id];
          const check = isPresent ? "[OK]" : "[ASSENTE]";
          doc.setTextColor(isPresent ? 0 : 200, isPresent ? 100 : 0, 0);
          doc.text(`${check} ${item.label}`, 14 + (index % 2) * 90, yPos);
          if (index % 2 === 1) yPos += 6;
        });
        yPos += 10;
      }

      if (logData.notes || logData.damages) {
        doc.setTextColor(0, 0, 0);
        doc.setFont("helvetica", "bold");
        doc.text("NOTE E SEGNALAZIONI", 14, yPos);
        yPos += 8;
        doc.setFont("helvetica", "normal");
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
        yPos += 10;
      }

      if (logData.photos && logData.photos.length > 0) {
        doc.setFont("helvetica", "bold");
        doc.text("FOTO ALLEGATE", 14, yPos);
        yPos += 8;
        logData.photos.forEach((photo: string, i: number) => {
          if (yPos > 250) {
            doc.addPage();
            yPos = 20;
          }
          try {
            doc.addImage(photo, "JPEG", 14 + i * 60, yPos, 50, 50);
          } catch (e) {}
        });
        yPos += 60;
      }

      if (logData.signature && yPos < 240) {
        doc.setDrawColor(0, 0, 0);
        doc.line(14, yPos, pageWidth - 14, yPos);
        yPos += 10;
        doc.setFont("helvetica", "bold");
        doc.text("FIRMA PER ACCETTAZIONE", 14, yPos);
        doc.addImage(logData.signature, "PNG", 14, yPos + 5, 60, 30);

        doc.setFontSize(8);
        doc.setFont("helvetica", "italic");
        doc.setTextColor(100, 100, 100);
        doc.text(
          "In caso di danneggiamento la società si riserva il diritto di addebitare il costo di riparazione al dipendente,",
          14,
          yPos + 40
        );
        doc.text(
          "nel caso in cui il danno ammonti ad un valore superiore ai 500€, nella misura del 20% dell'importo totale.",
          14,
          yPos + 44
        );
      }

      const dateStr = new Date(logData.date).toISOString().slice(0, 10);
      const idStr = logData.tripId ? `_TRIP-${logData.tripId}` : "";
      const filename = `${logData.plate}_${dateStr}${idStr}_${logData.type}.pdf`;

      doc.save(filename);
      setToast({
        visible: true,
        message: `PDF scaricato:\n${filename}`,
        type: "success",
      });
    } catch (err) {
      console.error(err);
      setToast({
        visible: true,
        message: "Errore generazione PDF",
        type: "error",
      });
    } finally {
      setGeneratingPdf(false);
    }
  };

  // --- ACTIONS ---
  const handleTransaction = async (e: any) => {
    e.preventDefault();
    if (!signature || !db) {
      alert("Firma obbligatoria.");
      return;
    }

    const type = modalMode === "checkout" ? "Consegna" : "Ritiro";
    const newStatus = modalMode === "checkout" ? "impegnato" : "disponibile";

    if (modalMode === "checkin" && parseInt(formData.km) < selectedVehicle.km) {
      alert("Km errati.");
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
            ? formData.commessa
            : selectedVehicle.commessa,
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

      await addDoc(
        collection(db, "artifacts", appId, "public", "data", "logs"),
        logData
      );
      generatePDF(logData);
      closeModal();
    } catch (err) {
      console.error(err);
      setToast({
        visible: true,
        message: "Errore salvataggio su Cloud.",
        type: "error",
      });
    }
  };

  const handleAddVehicle = async (e: any) => {
    e.preventDefault();
    if (!db) return;
    try {
      await addDoc(
        collection(db, "artifacts", appId, "public", "data", "vehicles"),
        {
          model: formData.model,
          plate: formData.plate.toUpperCase(),
          km: parseInt(formData.km),
          status: "disponibile",
          fuel: "Pieno",
        }
      );
      closeModal();
      setToast({
        visible: true,
        message: "Veicolo aggiunto.",
        type: "success",
      });
    } catch (err) {
      setToast({
        visible: true,
        message: "Errore salvataggio.",
        type: "error",
      });
    }
  };

  // NUOVA FUNZIONE: Modifica Veicolo
  const handleEditVehicle = async (e: any) => {
    e.preventDefault();
    if (!db || !selectedVehicle) return;
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
      });
      closeModal();
      setToast({
        visible: true,
        message: "Dati veicolo aggiornati.",
        type: "success",
      });
    } catch (err) {
      setToast({
        visible: true,
        message: "Errore aggiornamento.",
        type: "error",
      });
    }
  };

  const deleteVehicle = async (id: string) => {
    if (!db) return;
    if (confirm("Eliminare veicolo?")) {
      try {
        await deleteDoc(
          doc(db, "artifacts", appId, "public", "data", "vehicles", id)
        );
        setToast({
          visible: true,
          message: "Veicolo eliminato.",
          type: "success",
        });
      } catch (err) {
        setToast({
          visible: true,
          message: "Errore eliminazione.",
          type: "error",
        });
      }
    }
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
              className="rounded text-orange-600"
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
      <div className="flex rounded-md shadow-sm bg-gray-100 p-1">
        {FUEL_LEVELS.map((level) => (
          <button
            key={level}
            type="button"
            onClick={() => setFormData({ ...formData, fuel: level })}
            className={`flex-1 py-1.5 text-xs font-medium rounded ${
              formData.fuel === level
                ? "bg-white text-orange-600 shadow"
                : "text-gray-500"
            }`}
          >
            {level}
          </button>
        ))}
      </div>
    </div>
  );

  const openModal = (mode: string, vehicle: any = null) => {
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
      });
    } else {
      setFormData({});
    }
  };
  const closeModal = () => {
    setModalMode(null);
    setSelectedVehicle(null);
    setFormData({});
  };

  // --- VIEWS ---
  const renderDashboard = () => {
    // Filtra i veicoli in base alla ricerca Dashboard
    const filteredVehicles = vehicles.filter(
      (v) =>
        v.plate.toLowerCase().includes(searchDashboardTerm.toLowerCase()) ||
        v.model.toLowerCase().includes(searchDashboardTerm.toLowerCase())
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
          <div className="bg-red-100 p-4 text-red-800 rounded">
            Errore Permessi Database
          </div>
        )}

        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <h2 className="text-lg font-bold text-gray-800">Dashboard</h2>

          <div className="flex items-center gap-3">
            {/* Barra Ricerca Dashboard */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                className="pl-9 pr-4 py-1.5 border rounded-full text-sm focus:ring-2 focus:ring-orange-500 outline-none w-48"
                placeholder="Cerca targa/modello..."
                value={searchDashboardTerm}
                onChange={(e) => setSearchDashboardTerm(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2 text-green-600 text-xs font-medium bg-white px-2 py-1 rounded border">
              <Zap className="w-3 h-3" /> Sync
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <Card className="p-4 border-l-4 border-orange-500">
            <div>
              <p className="text-sm text-gray-500">Totale</p>
              <h3 className="text-2xl font-bold">{filteredVehicles.length}</h3>
            </div>
          </Card>
          <Card className="p-4 border-l-4 border-green-500">
            <div>
              <p className="text-sm text-gray-500">Disponibili</p>
              <h3 className="text-2xl font-bold">{available}</h3>
            </div>
          </Card>
          <Card className="p-4 border-l-4 border-red-500">
            <div>
              <p className="text-sm text-gray-500">In Uso</p>
              <h3 className="text-2xl font-bold">{busy}</h3>
            </div>
          </Card>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          {filteredVehicles
            .filter((v) => v.status === "disponibile")
            .map((v) => (
              <Card
                key={v.id}
                className="p-4 hover:shadow-md flex justify-between items-center"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                    <Car className="text-green-600 w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold">{v.model}</h4>
                    <p className="text-sm text-gray-500">{v.plate}</p>
                  </div>
                </div>
                <Button size="sm" onClick={() => openModal("checkout", v)}>
                  Consegna <ArrowRight className="w-4 h-4" />
                </Button>
              </Card>
            ))}
          {filteredVehicles
            .filter((v) => v.status === "impegnato")
            .map((v) => (
              <Card
                key={v.id}
                className="p-4 border-red-100 bg-red-50/30 flex justify-between items-center"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                    <User className="text-red-600 w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold">{v.model}</h4>
                    <p className="text-sm text-gray-600">
                      <span className="font-mono font-bold mr-1">
                        {v.plate}
                      </span>
                      • {v.driver}
                    </p>
                  </div>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => openModal("checkin", v)}
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
    const filteredFleet = vehicles.filter(
      (v) =>
        v.plate.toLowerCase().includes(searchFleetTerm.toLowerCase()) ||
        v.model.toLowerCase().includes(searchFleetTerm.toLowerCase())
    );
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold">Veicoli</h2>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-2 text-gray-400" />
              <input
                className="pl-9 pr-4 py-1 border rounded w-48"
                placeholder="Cerca targa..."
                value={searchFleetTerm}
                onChange={(e) => setSearchFleetTerm(e.target.value)}
              />
            </div>
            <Button onClick={() => openModal("add")}>
              <Plus className="w-4 h-4" /> Nuovo
            </Button>
          </div>
        </div>
        <div className="bg-white rounded shadow overflow-hidden">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="p-3">Modello</th>
                <th className="p-3">Targa</th>
                <th className="p-3">Km</th>
                <th className="p-3">Stato</th>
                <th className="p-3 text-right">Azioni</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredFleet.map((v) => (
                <tr key={v.id}>
                  <td className="p-3 font-medium">{v.model}</td>
                  <td className="p-3 font-mono">{v.plate}</td>
                  <td className="p-3">{v.km}</td>
                  <td className="p-3">
                    <Badge status={v.status} />
                  </td>
                  <td className="p-3 text-right flex justify-end gap-2">
                    <button
                      onClick={() => openModal("edit", v)}
                      className="text-blue-500 hover:bg-blue-50 p-2 rounded-full"
                      title="Modifica"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => deleteVehicle(v.id)}
                      className="text-red-500 hover:bg-red-50 p-2 rounded-full"
                      title="Elimina"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderHistory = () => {
    // Raggruppa per Trip ID
    const filteredLogs = logs.filter(
      (l) =>
        l.driver?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        l.plate?.toLowerCase().includes(searchTerm.toLowerCase())
    );
    const trips: any = {};
    filteredLogs.forEach((log) => {
      const tid = log.tripId || "LEGACY";
      if (!trips[tid]) trips[tid] = { id: tid, logs: [] };
      trips[tid].logs.push(log);
    });
    const sortedTripIds = Object.keys(trips).sort((a, b) => {
      const dateA = new Date(trips[a].logs[0].date).getTime();
      const dateB = new Date(trips[b].logs[0].date).getTime();
      return dateB - dateA;
    });

    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold">Storico Viaggi</h2>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2 text-gray-400" />
            <input
              className="pl-9 pr-4 py-1 border rounded w-64"
              placeholder="Cerca..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-6">
          {sortedTripIds.map((tid) => {
            const trip = trips[tid];
            const hasCheckin = trip.logs.some((l: any) => l.type === "Ritiro");
            const isClosed = hasCheckin;
            const mainLog = trip.logs[0];
            return (
              <div
                key={tid}
                className={`bg-white rounded-lg shadow-sm border-l-4 overflow-hidden ${
                  isClosed ? "border-green-500" : "border-orange-500"
                }`}
              >
                <div className="bg-gray-50 p-3 border-b flex justify-between items-center">
                  <div>
                    <h4 className="font-bold text-gray-800 flex items-center gap-2">
                      TRIP ID: #{tid}
                      {isClosed ? (
                        <span className="bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full">
                          Completato
                        </span>
                      ) : (
                        <span className="bg-orange-100 text-orange-700 text-xs px-2 py-0.5 rounded-full">
                          In Corso
                        </span>
                      )}
                    </h4>
                    <div className="text-sm text-gray-600 mt-1">
                      {mainLog.vehicleModel} - {mainLog.plate} |{" "}
                      {mainLog.driver}
                      {mainLog.commessa && (
                        <span className="ml-2 text-gray-500">
                          Comm: {mainLog.commessa}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="divide-y">
                  {trip.logs
                    .sort(
                      (a: any, b: any) =>
                        new Date(a.date).getTime() - new Date(b.date).getTime()
                    )
                    .map((l: any) => (
                      <div
                        key={l.id}
                        className="p-3 flex justify-between items-center hover:bg-gray-50"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`p-2 rounded-full ${
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
                            <div className="font-medium text-sm">{l.type}</div>
                            <div className="text-xs text-gray-500">
                              {new Date(l.date).toLocaleString()} - Km: {l.km}
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => generatePDF(l)}
                          className="text-blue-600 hover:underline text-xs flex items-center gap-1"
                        >
                          <FileDown className="w-3 h-3" /> PDF
                        </button>
                      </div>
                    ))}
                </div>
              </div>
            );
          })}
        </div>
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
          <div className="w-full max-w-lg transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
            <div className="flex justify-between items-center border-b pb-4 mb-4">
              <h3 className="text-lg font-bold text-gray-900">
                {isAdd
                  ? "Nuovo Veicolo"
                  : isEdit
                  ? "Modifica Veicolo"
                  : `${isCheckout ? "Consegna" : "Rientro"}: ${
                      selectedVehicle?.model
                    }`}
              </h3>
              <button
                onClick={closeModal}
                className="p-1 rounded-full hover:bg-gray-100"
              >
                <X className="w-5 h-5 text-gray-500" />
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
                    className="w-full border p-3 rounded-lg"
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
                    className="w-full border p-3 rounded-lg uppercase"
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
                    className="w-full border p-3 rounded-lg"
                    type="number"
                    value={formData.km || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, km: e.target.value })
                    }
                    required
                  />
                </div>
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
                {isCheckout && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Nome Cognome Driver
                      </label>
                      <input
                        className="w-full border p-3 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
                        placeholder="Es. Mario Rossi"
                        onChange={(e) =>
                          setFormData({ ...formData, driver: e.target.value })
                        }
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Commessa
                      </label>
                      <input
                        className="w-full border p-3 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
                        placeholder="Es. 23-050"
                        onChange={(e) =>
                          setFormData({ ...formData, commessa: e.target.value })
                        }
                      />
                    </div>
                  </>
                )}

                {modalMode === "checkin" && (
                  <div className="grid grid-cols-2 gap-4 bg-gray-50 p-3 rounded-lg border border-gray-200">
                    <div>
                      <span className="text-xs text-gray-500 uppercase font-bold">
                        Driver Uscita
                      </span>
                      <br />
                      <strong className="text-gray-900">
                        {selectedVehicle.driver}
                      </strong>
                    </div>
                    <div>
                      <span className="text-xs text-gray-500 uppercase font-bold">
                        Km Uscita
                      </span>
                      <br />
                      <strong className="text-gray-900">
                        {selectedVehicle.km}
                      </strong>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Km Attuali
                  </label>
                  <input
                    type="number"
                    className="w-full border p-3 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
                    value={formData.km || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, km: e.target.value })
                    }
                    required
                  />
                </div>

                {renderFuelSelector()}
                {renderChecklist()}

                <div className="bg-red-50 p-3 rounded-lg border border-red-100">
                  <label className="text-sm font-bold text-red-700 flex items-center gap-1 mb-2">
                    <AlertTriangle className="w-4 h-4" />{" "}
                    {isCheckout
                      ? "Danni Preesistenti"
                      : "Nuovi Danni / Anomalie"}
                  </label>
                  <textarea
                    className="w-full p-2 border border-red-200 rounded bg-white text-sm focus:ring-2 focus:ring-red-500 outline-none"
                    rows={2}
                    onChange={(e) =>
                      setFormData({ ...formData, damages: e.target.value })
                    }
                    placeholder={
                      isCheckout
                        ? "Segnala graffi o danni già presenti..."
                        : "Descrivi eventuali danni..."
                    }
                  ></textarea>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Note Generali
                  </label>
                  <textarea
                    className="w-full p-3 border rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                    rows={1}
                    onChange={(e) =>
                      setFormData({ ...formData, notes: e.target.value })
                    }
                    placeholder="Altre info..."
                  ></textarea>
                </div>

                <PhotoUpload photos={photos} setPhotos={setPhotos} />

                <SignaturePad
                  onSave={setSignature}
                  label="Firma"
                  disclaimer={
                    isCheckout
                      ? "In caso di danneggiamento la società si riserva il diritto di addebitare il costo di riparazione al dipendente, nel caso in cui il danno ammonti ad un valore superiore ai 500€, nella misura del 20% dell'importo totale."
                      : null
                  }
                />

                <div className="flex gap-3 pt-4">
                  <Button variant="secondary" onClick={closeModal}>
                    Annulla
                  </Button>
                  <Button type="submit" loading={generatingPdf}>
                    {isCheckout ? "Conferma" : "Rientro"}
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-20 font-sans text-slate-900">
      <Toast
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        onClose={() => setToast({ ...toast, visible: false })}
      />
      <header className="bg-slate-900 text-white p-4 shadow-lg sticky top-0 z-30">
        <div className="max-w-5xl mx-auto flex items-center gap-3">
          <div className="bg-orange-600 w-10 h-10 rounded flex items-center justify-center font-bold">
            R
          </div>
          <h1 className="text-xl font-bold">Renco Fleet Management</h1>
        </div>
      </header>
      <div className="max-w-5xl mx-auto px-4 mt-6">
        <nav className="flex gap-2 mb-6 bg-white p-1 rounded shadow w-fit">
          {["dashboard", "flotta", "storico"].map((t) => (
            <button
              key={t}
              onClick={() => setView(t)}
              className={`px-4 py-2 rounded capitalize ${
                view === t ? "bg-slate-100 font-bold" : "text-slate-500"
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
    </div>
  );
};

export default App;
