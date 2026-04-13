/**
 * CuePoint — Bitfocus Companion Module
 *
 * Provides actions to control CuePoint rooms/timers/messages
 * via the CuePoint HTTP API v1.
 *
 * Configuration: baseUrl (e.g. http://192.168.1.100:4000) + roomApiKey
 */
import {
  InstanceBase,
  runEntrypoint,
  type SomeCompanionConfigField,
  type CompanionActionDefinition,
  type CompanionFeedbackDefinition,
  Regex,
} from '@companion-module/base'

interface Config {
  baseUrl: string
  apiKey: string
}

interface Timer {
  id: string
  title: string | null
  isRunning: boolean
  durationMs: number
  elapsedMs: number
}

interface Message {
  id: string
  text: string
  visible: boolean
}

class CuepointInstance extends InstanceBase<Config> {
  private config: Config = { baseUrl: '', apiKey: '' }
  private timers: Timer[] = []
  private messages: Message[] = []
  private onAir = false

  override async init(config: Config) {
    this.config = config
    this.log('info', 'CuePoint module initialising')
    await this.fetchState()
    this.setActionDefinitions(this.buildActions())
    this.setFeedbackDefinitions(this.buildFeedbacks())
    this.updateStatus('ok')
  }

  override async destroy() {
    this.log('info', 'CuePoint module destroyed')
  }

  override async configUpdated(config: Config) {
    this.config = config
    await this.fetchState()
    this.checkFeedbacks()
  }

  override getConfigFields(): SomeCompanionConfigField[] {
    return [
      {
        type: 'textinput',
        id: 'baseUrl',
        label: 'CuePoint API URL',
        default: 'http://localhost:4000',
        regex: Regex.URL,
        width: 8,
      },
      {
        type: 'textinput',
        id: 'apiKey',
        label: 'Room API key',
        default: '',
        width: 8,
      },
    ]
  }

  // ── HTTP helpers ───────────────────────────────────────────

  private async apiRequest(method: string, path: string, body?: unknown) {
    const url = `${this.config.baseUrl}/api/v1${path}`
    const resp = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(8_000),
    })
    if (!resp.ok) throw new Error(`${method} ${path} → ${resp.status}`)
    if (resp.status === 204) return undefined
    return resp.json()
  }

  private async fetchState() {
    try {
      const [roomResp, timersResp, msgsResp] = await Promise.all([
        this.apiRequest('GET', '/room') as Promise<{ onAir: boolean }>,
        this.apiRequest('GET', '/timers') as Promise<Timer[]>,
        this.apiRequest('GET', '/messages') as Promise<Message[]>,
      ])
      this.onAir = roomResp.onAir
      this.timers = timersResp
      this.messages = msgsResp
    } catch (err) {
      this.log('warn', `Failed to fetch state: ${String(err)}`)
      this.updateStatus('connection_failure', 'Cannot reach CuePoint API')
    }
  }

  // ── Choices ────────────────────────────────────────────────

  private timerChoices() {
    return this.timers.map((t) => ({ id: t.id, label: t.title ?? `Timer ${t.id.slice(-6)}` }))
  }

  private messageChoices() {
    return this.messages.map((m) => ({ id: m.id, label: m.text.slice(0, 60) }))
  }

  // ── Actions ────────────────────────────────────────────────

  private buildActions(): { [id: string]: CompanionActionDefinition } {
    return {
      timer_start: {
        name: 'Start timer',
        options: [{ type: 'dropdown', id: 'timerId', label: 'Timer', choices: this.timerChoices(), default: '' }],
        callback: async (action) => {
          await this.apiRequest('POST', `/timers/${action.options['timerId']}/start`)
          await this.fetchState(); this.checkFeedbacks()
        },
      },
      timer_stop: {
        name: 'Stop timer',
        options: [{ type: 'dropdown', id: 'timerId', label: 'Timer', choices: this.timerChoices(), default: '' }],
        callback: async (action) => {
          await this.apiRequest('POST', `/timers/${action.options['timerId']}/stop`)
          await this.fetchState(); this.checkFeedbacks()
        },
      },
      timer_pause: {
        name: 'Pause timer',
        options: [{ type: 'dropdown', id: 'timerId', label: 'Timer', choices: this.timerChoices(), default: '' }],
        callback: async (action) => {
          await this.apiRequest('POST', `/timers/${action.options['timerId']}/pause`)
          await this.fetchState(); this.checkFeedbacks()
        },
      },
      timer_resume: {
        name: 'Resume timer',
        options: [{ type: 'dropdown', id: 'timerId', label: 'Timer', choices: this.timerChoices(), default: '' }],
        callback: async (action) => {
          await this.apiRequest('POST', `/timers/${action.options['timerId']}/resume`)
          await this.fetchState(); this.checkFeedbacks()
        },
      },
      timer_reset: {
        name: 'Reset timer',
        options: [{ type: 'dropdown', id: 'timerId', label: 'Timer', choices: this.timerChoices(), default: '' }],
        callback: async (action) => {
          await this.apiRequest('POST', `/timers/${action.options['timerId']}/reset`)
          await this.fetchState(); this.checkFeedbacks()
        },
      },
      timer_adjust: {
        name: 'Adjust timer',
        options: [
          { type: 'dropdown', id: 'timerId', label: 'Timer', choices: this.timerChoices(), default: '' },
          { type: 'number', id: 'adjustSec', label: 'Adjust (seconds, negative to subtract)', default: 60, min: -3600, max: 3600, step: 1 },
        ],
        callback: async (action) => {
          const adjustMs = Number(action.options['adjustSec']) * 1000
          await this.apiRequest('POST', `/timers/${action.options['timerId']}/adjust`, { adjustMs })
          await this.fetchState(); this.checkFeedbacks()
        },
      },
      message_show: {
        name: 'Show message',
        options: [{ type: 'dropdown', id: 'messageId', label: 'Message', choices: this.messageChoices(), default: '' }],
        callback: async (action) => {
          await this.apiRequest('POST', `/messages/${action.options['messageId']}/show`)
          await this.fetchState(); this.checkFeedbacks()
        },
      },
      message_hide: {
        name: 'Hide message',
        options: [{ type: 'dropdown', id: 'messageId', label: 'Message', choices: this.messageChoices(), default: '' }],
        callback: async (action) => {
          await this.apiRequest('POST', `/messages/${action.options['messageId']}/hide`)
          await this.fetchState(); this.checkFeedbacks()
        },
      },
      set_on_air: {
        name: 'Set on air',
        options: [{ type: 'checkbox', id: 'onAir', label: 'On air', default: true }],
        callback: async (action) => {
          await this.apiRequest('PATCH', '/room', { onAir: Boolean(action.options['onAir']) })
          await this.fetchState(); this.checkFeedbacks()
        },
      },
      set_blackout: {
        name: 'Set blackout',
        options: [{ type: 'checkbox', id: 'blackout', label: 'Blackout', default: true }],
        callback: async (action) => {
          await this.apiRequest('PATCH', '/room', { blackout: Boolean(action.options['blackout']) })
          await this.fetchState(); this.checkFeedbacks()
        },
      },
    }
  }

  // ── Feedbacks ──────────────────────────────────────────────

  private buildFeedbacks(): { [id: string]: CompanionFeedbackDefinition } {
    return {
      timer_running: {
        type: 'boolean',
        name: 'Timer is running',
        description: 'Active when the selected timer is running',
        defaultStyle: { bgcolor: 0x00aa00, color: 0xffffff },
        options: [{ type: 'dropdown', id: 'timerId', label: 'Timer', choices: this.timerChoices(), default: '' }],
        callback: (feedback) => {
          const t = this.timers.find((x) => x.id === feedback.options['timerId'])
          return t?.isRunning ?? false
        },
      },
      on_air: {
        type: 'boolean',
        name: 'Room is on air',
        description: 'Active when the room On Air flag is set',
        defaultStyle: { bgcolor: 0xdd0000, color: 0xffffff },
        options: [],
        callback: () => this.onAir,
      },
    }
  }
}

runEntrypoint(CuepointInstance, [])
