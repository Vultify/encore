import { EQ_BANDS, EQ_Q, equalizerGains, peakBoost, type EqualizerSettings } from '@shared/equalizer'

// How quickly the sound glides to new levels, in seconds, so moving a slider never clicks.
const GLIDE = 0.02
// After this long paused, the chain stops running in the background.
const SLEEP_AFTER_MS = 10_000

// Runs the player's sound through ten filters, one per band, then a volume trim that makes room for boosts.
// It's built the first time the equalizer changes anything; until then songs play straight from the audio element.
export class EqualizerChain {
  private context: AudioContext | null = null
  private bands: BiquadFilterNode[] = []
  private trim: GainNode | null = null
  private sleepTimer: number | undefined

  constructor(private readonly audio: HTMLAudioElement) {}

  apply(settings: EqualizerSettings): void {
    const gains = settings.enabled ? equalizerGains(settings) : EQ_BANDS.map(() => 0)
    if (!this.context && gains.every((gain) => gain === 0)) return
    const context = this.build()
    const now = context.currentTime
    gains.forEach((gain, i) => this.bands[i].gain.setTargetAtTime(gain, now, GLIDE))
    this.trim!.gain.setTargetAtTime(10 ** (-peakBoost(gains, context.sampleRate) / 20), now, GLIDE)
  }

  // Wakes the chain when a song plays, and lets it sleep once the music has been paused a while.
  setPlaying(playing: boolean): void {
    if (!this.context) return
    window.clearTimeout(this.sleepTimer)
    if (playing) void this.context.resume()
    else this.sleepTimer = window.setTimeout(() => void this.context?.suspend(), SLEEP_AFTER_MS)
  }

  close(): void {
    window.clearTimeout(this.sleepTimer)
    void this.context?.close()
  }

  private build(): AudioContext {
    if (this.context) return this.context
    const context = new AudioContext()
    this.bands = EQ_BANDS.map((frequency) => new BiquadFilterNode(context, { type: 'peaking', frequency, Q: EQ_Q, gain: 0 }))
    this.trim = new GainNode(context)
    const chain: AudioNode[] = [context.createMediaElementSource(this.audio), ...this.bands, this.trim, context.destination]
    chain.slice(1).forEach((node, i) => chain[i].connect(node))
    this.context = context
    if (this.audio.paused) this.setPlaying(false)
    return context
  }
}
