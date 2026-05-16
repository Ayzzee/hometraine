import asyncio
import tkinter as tk
from tkinter import ttk
import time
from datetime import datetime
from bleak import BleakScanner, BleakClient

import matplotlib
matplotlib.use("TkAgg")
from matplotlib.figure import Figure
from matplotlib.backends.backend_tkagg import FigureCanvasTkAgg

# Configuration Turno / Misuro B+
WHEEL_CIRCUMFERENCE_M = 0.135  # ~ 2070mm / 15.34 (ratio standard Elite Turno/Misuro B+)

class TrainerApp:
    def __init__(self, root):
        self.root = root
        self.root.title("Home Trainer - Elite Turno")
        self.root.geometry("800x650")
        self.root.configure(bg="#f5f6fa")
        self.root.minsize(700, 550)
        
        # Variables d'état
        self.is_active = False
        self.start_time = None
        self.end_time = None
        self.pedaling_time = 0.0  # Temps passé à pédaler (secondes)
        
        self.last_update_time = time.time()
        self.last_data_time = time.time()
        self.last_plot_update = time.time()
        
        self.instant_watts = 0
        self.instant_speed = 0.0
        
        self.sum_watts = 0.0
        self.sum_speed = 0.0
        
        # Tableaux de données pour les graphiques
        self.time_history = []
        self.watts_history = []
        self.speed_history = []
        
        # Variables pour le calcul de vitesse (roue)
        self.last_wheel_revs = None
        self.last_wheel_time = None
        
        self.create_widgets()

    def create_widgets(self):
        style = ttk.Style()
        style.theme_use("clam")
        
        # Style des onglets
        style.configure("TNotebook", background="#f5f6fa")
        style.configure("TNotebook.Tab", font=("Helvetica", 12, "bold"), padding=[10, 5])
        
        # Style des boutons
        style.configure("Start.TButton", font=("Helvetica", 14, "bold"), foreground="#44bd32", padding=10)
        style.configure("Stop.TButton", font=("Helvetica", 14, "bold"), foreground="#e84118", padding=10)
        
        # Configuration des couleurs et polices
        bg_color = "#f5f6fa"
        text_color = "#2f3640"
        accent_color_watts = "#e15f41"
        accent_color_speed = "#3dc1d3"
        card_bg = "#ffffff"
        
        # --- SYSTEME D'ONGLETS ---
        self.notebook = ttk.Notebook(self.root)
        self.notebook.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)
        
        self.tab_dashboard = tk.Frame(self.notebook, bg=bg_color)
        self.tab_graphs = tk.Frame(self.notebook, bg=bg_color)
        
        self.notebook.add(self.tab_dashboard, text="📊 Tableau de Bord")
        self.notebook.add(self.tab_graphs, text="📈 Graphiques (Live)")
        
        # --- ONGLETS 1 : DASHBOARD ---
        main_frame = tk.Frame(self.tab_dashboard, bg=bg_color, padx=10, pady=10)
        main_frame.pack(fill=tk.BOTH, expand=True)
        
        # --- HEADER (Status) ---
        header_frame = tk.Frame(main_frame, bg=bg_color)
        header_frame.pack(fill=tk.X, pady=(0, 20))
        
        self.status_var = tk.StringVar(value="Recherche d'appareils Bluetooth...")
        status_label = tk.Label(header_frame, textvariable=self.status_var, font=("Helvetica", 12, "italic"), bg=bg_color, fg="#718093")
        status_label.pack()
        
        # --- DASHBOARD (Grille Centrale) ---
        dashboard_frame = tk.Frame(main_frame, bg=bg_color)
        dashboard_frame.pack(fill=tk.BOTH, expand=True)
        dashboard_frame.columnconfigure(0, weight=1)
        dashboard_frame.columnconfigure(1, weight=1)
        
        # Carte Watts (Gauche)
        watts_card = tk.Frame(dashboard_frame, bg=card_bg, padx=20, pady=30, highlightbackground="#dcdde1", highlightthickness=1)
        watts_card.grid(row=0, column=0, padx=10, pady=10, sticky="nsew")
        
        self.watts_var = tk.StringVar(value="0 W")
        tk.Label(watts_card, text="⚡ PUISSANCE", font=("Helvetica", 14, "bold"), bg=card_bg, fg="#7f8fa6").pack(pady=(0, 10))
        tk.Label(watts_card, textvariable=self.watts_var, font=("Helvetica", 54, "bold"), bg=card_bg, fg=accent_color_watts).pack()
        
        self.avg_watts_var = tk.StringVar(value="Moyenne : 0 W")
        tk.Label(watts_card, textvariable=self.avg_watts_var, font=("Helvetica", 14), bg=card_bg, fg=text_color).pack(pady=(10, 0))
        
        # Carte Vitesse (Droite)
        speed_card = tk.Frame(dashboard_frame, bg=card_bg, padx=20, pady=30, highlightbackground="#dcdde1", highlightthickness=1)
        speed_card.grid(row=0, column=1, padx=10, pady=10, sticky="nsew")
        
        self.speed_var = tk.StringVar(value="0.0 km/h")
        tk.Label(speed_card, text="🚴 VITESSE", font=("Helvetica", 14, "bold"), bg=card_bg, fg="#7f8fa6").pack(pady=(0, 10))
        tk.Label(speed_card, textvariable=self.speed_var, font=("Helvetica", 54, "bold"), bg=card_bg, fg=accent_color_speed).pack()
        
        self.avg_speed_var = tk.StringVar(value="Moyenne : 0.0 km/h")
        tk.Label(speed_card, textvariable=self.avg_speed_var, font=("Helvetica", 14), bg=card_bg, fg=text_color).pack(pady=(10, 0))
        
        # --- BLOC DUREE ET TEMPS ---
        time_frame = tk.Frame(main_frame, bg=bg_color)
        time_frame.pack(fill=tk.X, pady=(20, 20))
        
        self.duration_var = tk.StringVar(value="⏱ Temps d'effort : 00:00")
        tk.Label(time_frame, textvariable=self.duration_var, font=("Helvetica", 20, "bold"), bg=bg_color, fg=text_color).pack()
        
        self.time_var = tk.StringVar(value="Début : --:--   |   Fin : --:--")
        tk.Label(time_frame, textvariable=self.time_var, font=("Helvetica", 12), bg=bg_color, fg="#7f8fa6").pack(pady=(5, 0))
        
        # --- BOUTONS ---
        btn_frame = tk.Frame(main_frame, bg=bg_color)
        btn_frame.pack(fill=tk.X, pady=(10, 0))
        
        self.start_btn = ttk.Button(btn_frame, text="▶ DÉBUTER L'ENTRAÎNEMENT", command=self.start_activity, style="Start.TButton")
        self.start_btn.pack(side=tk.LEFT, expand=True, padx=10, fill=tk.X, ipady=10)
        
        self.stop_btn = ttk.Button(btn_frame, text="⏹ TERMINER", command=self.stop_activity, state=tk.DISABLED, style="Stop.TButton")
        self.stop_btn.pack(side=tk.RIGHT, expand=True, padx=10, fill=tk.X, ipady=10)
        
        # --- ONGLET 2 : GRAPHIQUES ---
        self.setup_plots()

    def setup_plots(self):
        # Création de la figure matplotlib avec 2 sous-graphiques
        self.fig = Figure(figsize=(6, 5), dpi=100)
        self.fig.patch.set_facecolor('#f5f6fa')
        
        self.ax_watts = self.fig.add_subplot(211)
        self.ax_speed = self.fig.add_subplot(212)
        
        self.ax_watts.set_title("Puissance au cours du temps (Watts)", fontweight="bold")
        self.ax_speed.set_title("Vitesse au cours du temps (km/h)", fontweight="bold")
        self.ax_speed.set_xlabel("Temps écoulé (s)")
        
        self.ax_watts.grid(True, linestyle="--", alpha=0.6)
        self.ax_speed.grid(True, linestyle="--", alpha=0.6)
        
        # Initialisation des lignes vides
        self.line_watts, = self.ax_watts.plot([], [], color="#e15f41", lw=2)
        self.line_speed, = self.ax_speed.plot([], [], color="#3dc1d3", lw=2)
        
        self.fig.tight_layout()
        
        # Intégration dans Tkinter
        self.canvas = FigureCanvasTkAgg(self.fig, master=self.tab_graphs)
        self.canvas.draw()
        self.canvas.get_tk_widget().pack(fill=tk.BOTH, expand=True, padx=10, pady=10)

    def start_activity(self):
        self.is_active = True
        self.start_time = datetime.now()
        self.end_time = None
        self.pedaling_time = 0.0
        self.sum_watts = 0.0
        self.sum_speed = 0.0
        
        # Réinitialisation de l'historique
        self.time_history = []
        self.watts_history = []
        self.speed_history = []
        self.update_plots()
        
        self.start_btn.config(state=tk.DISABLED)
        self.stop_btn.config(state=tk.NORMAL)
        self.update_display()
        
    def stop_activity(self):
        self.is_active = False
        self.end_time = datetime.now()
        
        self.start_btn.config(state=tk.NORMAL)
        self.stop_btn.config(state=tk.DISABLED)
        self.update_display()

    def receive_data(self, watts, speed=None):
        self.instant_watts = watts
        if speed is not None:
            self.instant_speed = speed
        self.last_data_time = time.time()

    def tick(self):
        """Méthode appelée régulièrement pour mettre à jour les statistiques et l'affichage"""
        now = time.time()
        
        # Si aucune donnée n'est reçue pendant 2.5 secondes, on remet les compteurs à 0 (pause)
        if now - self.last_data_time > 2.5:
            self.instant_watts = 0
            self.instant_speed = 0.0

        dt = now - self.last_update_time
        self.last_update_time = now
        
        if self.is_active:
            # On exclut les pauses: on considère qu'on pédale si watts > 0 ou vitesse > 0
            if self.instant_watts > 0 or self.instant_speed > 0.5:
                self.pedaling_time += dt
                self.sum_watts += self.instant_watts * dt
                self.sum_speed += self.instant_speed * dt
                
            # --- Enregistrement de l'historique pour les graphiques ---
            if now - self.last_plot_update >= 1.0: # Mise à jour chaque seconde
                elapsed = (datetime.now() - self.start_time).total_seconds()
                self.time_history.append(elapsed)
                self.watts_history.append(self.instant_watts)
                self.speed_history.append(self.instant_speed)
                
                self.update_plots()
                self.last_plot_update = now
                
        self.update_display()

    def update_plots(self):
        if not self.time_history:
            self.line_watts.set_data([], [])
            self.line_speed.set_data([], [])
            self.canvas.draw()
            return
            
        self.line_watts.set_data(self.time_history, self.watts_history)
        self.line_speed.set_data(self.time_history, self.speed_history)
        
        self.ax_watts.relim()
        self.ax_watts.autoscale_view(scalex=True, scaley=True)
        self.ax_speed.relim()
        self.ax_speed.autoscale_view(scalex=True, scaley=True)
        
        # Redessiner uniquement si l'onglet graphiques est visible pour optimiser
        # Mais pour plus de simplicité, on redessine tout le temps.
        self.canvas.draw()

    def update_display(self):
        self.watts_var.set(f"{self.instant_watts} W")
        self.speed_var.set(f"{self.instant_speed:.1f} km/h")
        
        if self.is_active and self.pedaling_time > 0:
            avg_watts = self.sum_watts / self.pedaling_time
            avg_speed = self.sum_speed / self.pedaling_time
            self.avg_watts_var.set(f"Moyenne : {int(avg_watts)} W")
            self.avg_speed_var.set(f"Moyenne : {avg_speed:.1f} km/h")
            
            mins, secs = divmod(int(self.pedaling_time), 60)
            self.duration_var.set(f"Durée (Effort) : {mins:02d}:{secs:02d}")
            
        start_str = self.start_time.strftime("%H:%M:%S") if self.start_time else "--:--"
        end_str = self.end_time.strftime("%H:%M:%S") if self.end_time else "--:--"
        self.time_var.set(f"Début : {start_str} | Fin : {end_str}")


# ---- BLEAK BLUETOOTH LOGIC ----

app = None

def callback_puissance(sender, data):
    global app
    if not app: return
    
    # Lecture de la puissance (2 octets suivants après les flags)
    watts = int.from_bytes(data[2:4], byteorder='little', signed=True)
    app.receive_data(watts)


def callback_vitesse(sender, data):
    """Callback pour le service CSC (Cycling Speed and Cadence)"""
    global app
    if not app: return
    
    flags = data[0]
    wheel_rev_present = bool(flags & (1 << 0))
    
    if wheel_rev_present and len(data) >= 7:
        cumulative_wheel_revs = int.from_bytes(data[1:5], byteorder='little')
        last_wheel_time = int.from_bytes(data[5:7], byteorder='little') # en 1/1024s
        
        if app.last_wheel_revs is not None and app.last_wheel_time is not None:
            # Calcul de la différence
            d_revs = cumulative_wheel_revs - app.last_wheel_revs
            d_time = last_wheel_time - app.last_wheel_time
            
            # Gestion des débordements (rollover)
            if d_time < 0:
                d_time += 65536
            if d_revs < 0:
                d_revs += 4294967296
                
            if d_time > 0:
                time_s = d_time / 1024.0
                distance_m = d_revs * WHEEL_CIRCUMFERENCE_M
                speed_ms = distance_m / time_s
                speed_kmh = speed_ms * 3.6
                
                app.receive_data(app.instant_watts, speed_kmh)
                
        app.last_wheel_revs = cumulative_wheel_revs
        app.last_wheel_time = last_wheel_time


async def bluetooth_task():
    global app
    
    print("Scan des appareils Bluetooth à proximité...")
    app.status_var.set("Scan des appareils Bluetooth...")
    devices = await BleakScanner.discover(timeout=5.0)
    
    target_address = None
    target_name = None
    
    for d in devices:
        name = d.name.upper() if d.name else ""
        if any(x in name for x in ["TURNO", "MISURO", "ELITE"]):
            target_address = d.address
            target_name = d.name
            break
            
    if not target_address:
        print("[Erreur] Aucun capteur Turno détecté dans le scan.")
        app.status_var.set("Erreur : Aucun capteur Turno détecté.")
        return

    print(f"Appareil détecté : {target_name} ({target_address})")
    app.status_var.set(f"Connexion à {target_name}...")
    
    for attempt in range(1, 4):
        try:
            print(f"Tentative de connexion {attempt}/3...")
            # Un petit délai aide parfois le contrôleur Bluetooth Linux
            await asyncio.sleep(1.0)
            
            async with BleakClient(target_address, timeout=40.0) as client:
                if client.is_connected:
                    print(f"Connecté avec succès à {target_name} !")
                    app.status_var.set(f"Connecté ({target_name}). Prêt !")
                    
                    CPS_UUID = "00002a63-0000-1000-8000-00805f9b34fb" # Puissance
                    CSC_UUID = "00002a5b-0000-1000-8000-00805f9b34fb" # Vitesse/Cadence
                    
                    # Essayer de s'abonner aux Watts
                    try:
                        await client.start_notify(CPS_UUID, callback_puissance)
                        print("Abonnement au service de puissance (Watts) OK.")
                    except Exception as e:
                        print(f"Erreur abonnement Puissance: {e}")
                        
                    # Essayer de s'abonner à la Vitesse
                    try:
                        await client.start_notify(CSC_UUID, callback_vitesse)
                        print("Abonnement au service de vitesse OK.")
                    except Exception as e:
                        print(f"Information: Pas de service vitesse séparé trouvé.")
                    
                    print("\nEn attente des données (pédalez pour envoyer des Watts) :\n")
                    
                    # Boucle infinie pour garder la connexion ouverte
                    while client.is_connected:
                        await asyncio.sleep(1)
                    
                    print("L'appareil s'est déconnecté.")
                    app.status_var.set("Déconnecté.")
                    break # Sort de la boucle de tentatives si on était connecté
                else:
                    print(f"Échec de la connexion à {target_name}.")
        except Exception as e:
             print(f"Erreur lors de la tentative {attempt} : {e}")
             if attempt == 3:
                 print("\n[CONSEIL] Si la connexion échoue toujours :")
                 print("1. Donnez quelques coups de pédale pour réveiller le capteur.")
                 print("2. Vérifiez qu'aucune autre application (Zwift, téléphone) n'est connectée.")
                 print("3. Essayez de redémarrer le Bluetooth de votre ordinateur.")
                 app.status_var.set(f"Erreur de connexion après 3 essais.")
             else:
                 print("Nouvelle tentative dans 2 secondes...")
                 await asyncio.sleep(2.0)

async def main():
    global app
    root = tk.Tk()
    app = TrainerApp(root)
    
    # Lancement de la tâche Bluetooth en arrière-plan
    bt_task = asyncio.create_task(bluetooth_task())
    
    # Boucle d'événement Tkinter intégrée à Asyncio
    while True:
        try:
            app.tick()
            root.update()
        except tk.TclError:
            # Fenêtre fermée par l'utilisateur
            bt_task.cancel()
            break
        await asyncio.sleep(0.05)

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass