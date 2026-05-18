# Volumio 3 Auto-Shutdown Plugin

[Deutsch](#deutsch) | [English](#english)

---

## Deutsch

Ein intelligentes Auto-Shutdown-Plugin für **Volumio 3**, das die Box nach einer definierten Zeit der Inaktivität sicher herunterfährt. 

### Das Problem bei Podcasts & Hörbüchern
Viele Player-Plugins in Volumio (z.B. für Podcasts oder Webradio) verbleiben nach dem Ende der Wiedergabe im Zustand `Wiedergabe` (Playing), obwohl kein Ton mehr ausgegeben wird. Standardmäßige Auto-Shutdown-Plugins, die nur den Software-Wiedergabestatus prüfen, greifen hierbei nicht.

### Die Lösung
Dieses Plugin führt eine **Hardware-PCM-Statusüberwachung** durch. Es wertet direkt die Soundkartendateien unter `/proc/asound/` aus (`state: RUNNING` vs `state: CLOSED`). Erst wenn sowohl der Volumio-Softwareplayer stoppt **als auch** kein Audiosignal mehr über die Soundkarte wiedergegeben wird, beginnt der Inaktivitäts-Timer.

---

### Features
* **Detaillierte Inaktivitätserkennung**: Kombiniert den Volumio-Player-Status und den physikalischen PCM-Status der Soundkarte.
* **Dynamische Soundkarten-Erkennung**: Erkennt beim Laden der Einstellungen automatisch alle aktiven Soundkarten auf Ihrem Gerät und stellt sie als Dropdown zur Auswahl.
* **Flexibler Shutdown**: 
  - **Standard-Shutdown**: Führt ein sicheres `sudo shutdown -h now` oder `poweroff` aus.
  - **OnOff SHIM Integration**: Sendet eine kurze LOW-Pulssequenz an GPIO 17, um das Pimoroni OnOff SHIM zur vollständigen Stromtrennung zu triggern.
* **Volle UI-Integration**: Alle Parameter lassen sich direkt in den Volumio-Einstellungen konfigurieren.
* **Mehrsprachig**: Vollständige Unterstützung für Deutsch und Englisch.

---

### Installation

1. Verbinden Sie sich per SSH mit Ihrem Volumio-Gerät:
   ```bash
   ssh volumio@<volumio-ip>
   ```

2. Laden Sie dieses Repository in das Plugin-Verzeichnis herunter:
   ```bash
   cd /data/plugins/system_controller
   git clone https://github.com/PowderK/volumio_autoshutdown autoshutdown
   ```

3. Wechseln Sie in das Verzeichnis und installieren Sie das Plugin:
   ```bash
   cd autoshutdown
   volumio plugin install
   ```

4. Aktivieren Sie das Plugin in der Weboberfläche von Volumio unter **Plugins -> Installierte Plugins** und konfigurieren Sie Ihre Soundkarte und Wunschzeiten unter **Einstellungen**.

---

## English

An intelligent auto-shutdown plugin for **Volumio 3** that safely powers down the system after a set period of inactivity.

### The Podcast & Audiobook Problem
Many playback plugins in Volumio (e.g., for podcasts or web radio) remain in the `playing` state even after the actual track has finished and audio output has ceased. Traditional auto-shutdown plugins that only monitor the software state will fail to detect this and keep the device powered on.

### The Solution
This plugin performs **hardware-level PCM status monitoring**. It directly queries the soundcard status files under `/proc/asound/` (`state: RUNNING` vs. `state: CLOSED`). The inactivity timer only begins ticking when both the Volumio software player is stopped **and** no active audio signal is output through the physical soundcard.

---

### Features
* **Dual Inactivity Check**: Combines Volumio playback status and physical soundcard PCM output.
* **Dynamic Soundcard Discovery**: Automatically scans `/proc/asound/` and lists all active playback cards as a drop-down menu in the UI.
* **Flexible Shutdown Triggers**:
  - **Standard Shutdown**: Safe system shutdown (`sudo shutdown -h now` / `poweroff`).
  - **OnOff SHIM Integration**: Triggers a short LOW pulse on GPIO 17 to initiate Pimoroni OnOff SHIM physical power-cut sequence.
* **Web UI Configurable**: Easily adjust all parameters directly inside Volumio's plugin settings.
* **Multilingual**: Native support for English and German.

---

### Installation

1. Connect to your Volumio device via SSH:
   ```bash
   ssh volumio@<volumio-ip>
   ```

2. Clone this repository into the Volumio plugins directory:
   ```bash
   cd /data/plugins/system_controller
   git clone https://github.com/PowderK/volumio_autoshutdown autoshutdown
   ```

3. Navigate to the plugin directory and run the installer:
   ```bash
   cd autoshutdown
   volumio plugin install
   ```

4. Enable the plugin in the Volumio Web UI under **Plugins -> Installed Plugins** and configure your soundcard and timers under **Settings**.
