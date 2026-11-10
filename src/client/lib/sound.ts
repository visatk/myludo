class SoundEngine {
	private ctx: AudioContext | null = null;
	public muted = false;

	private getContext(): AudioContext | null {
		if (this.muted || typeof window === "undefined") return null;
		if (!this.ctx) {
			const AudioCtx =
				window.AudioContext ||
				(window as unknown as { webkitAudioContext: typeof AudioContext })
					.webkitAudioContext;
			if (AudioCtx) {
				this.ctx = new AudioCtx();
			}
		}
		if (this.ctx && this.ctx.state === "suspended") {
			void this.ctx.resume();
		}
		return this.ctx;
	}

	playDiceRoll(): void {
		const ctx = this.getContext();
		if (!ctx) return;
		const now = ctx.currentTime;
		for (let i = 0; i < 4; i++) {
			const osc = ctx.createOscillator();
			const gain = ctx.createGain();
			osc.type = "triangle";
			osc.frequency.setValueAtTime(240 + i * 95, now + i * 0.055);
			gain.gain.setValueAtTime(0.08, now + i * 0.055);
			gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.055 + 0.045);
			osc.connect(gain);
			gain.connect(ctx.destination);
			osc.start(now + i * 0.055);
			osc.stop(now + i * 0.055 + 0.05);
		}
	}

	playTokenHop(stepIndex = 0): void {
		const ctx = this.getContext();
		if (!ctx) return;
		const now = ctx.currentTime;
		const osc = ctx.createOscillator();
		const gain = ctx.createGain();
		osc.type = "sine";
		const baseFreq = 380 + (stepIndex % 8) * 35;
		osc.frequency.setValueAtTime(baseFreq, now);
		osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.35, now + 0.07);
		gain.gain.setValueAtTime(0.1, now);
		gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
		osc.connect(gain);
		gain.connect(ctx.destination);
		osc.start(now);
		osc.stop(now + 0.085);
	}

	playBonusSix(): void {
		const ctx = this.getContext();
		if (!ctx) return;
		const now = ctx.currentTime;
		const notes = [523.25, 659.25, 783.99];
		notes.forEach((freq, idx) => {
			const osc = ctx.createOscillator();
			const gain = ctx.createGain();
			osc.type = "triangle";
			osc.frequency.setValueAtTime(freq, now + idx * 0.06);
			gain.gain.setValueAtTime(0.11, now + idx * 0.06);
			gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.06 + 0.16);
			osc.connect(gain);
			gain.connect(ctx.destination);
			osc.start(now + idx * 0.06);
			osc.stop(now + idx * 0.06 + 0.17);
		});
	}

	playCapture(): void {
		const ctx = this.getContext();
		if (!ctx) return;
		const now = ctx.currentTime;
		const notes = [660, 880, 1046.5];
		notes.forEach((freq, idx) => {
			const osc = ctx.createOscillator();
			const gain = ctx.createGain();
			osc.type = "sawtooth";
			osc.frequency.setValueAtTime(freq, now + idx * 0.07);
			gain.gain.setValueAtTime(0.09, now + idx * 0.07);
			gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.07 + 0.22);
			osc.connect(gain);
			gain.connect(ctx.destination);
			osc.start(now + idx * 0.07);
			osc.stop(now + idx * 0.07 + 0.23);
		});
	}

	playVictory(): void {
		const ctx = this.getContext();
		if (!ctx) return;
		const now = ctx.currentTime;
		const fanfare = [523.25, 659.25, 783.99, 1046.5];
		fanfare.forEach((freq, idx) => {
			const osc = ctx.createOscillator();
			const gain = ctx.createGain();
			osc.type = "triangle";
			osc.frequency.setValueAtTime(freq, now + idx * 0.11);
			gain.gain.setValueAtTime(0.14, now + idx * 0.11);
			gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.11 + 0.35);
			osc.connect(gain);
			gain.connect(ctx.destination);
			osc.start(now + idx * 0.11);
			osc.stop(now + idx * 0.11 + 0.36);
		});
	}
}

export const soundEngine = new SoundEngine();
