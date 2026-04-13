import { test, expect } from '@playwright/test'
import { CONTROLLER_TOKEN_HEADER, defaultCustomOutputLayout } from '@cuepoint/shared'

const API_ORIGIN = process.env.E2E_API_ORIGIN ?? 'http://127.0.0.1:4000'

test.describe('CUSTOM output link (browser)', () => {
  test('short link loads custom stage with default timer title', async ({ page, request }) => {
    const health = await request.get(`${API_ORIGIN}/health`)
    const web = await request.get('http://127.0.0.1:5173/').catch(() => null)
    test.skip(
      !health.ok() || !web?.ok(),
      `Need API (${API_ORIGIN}/health) and Vite (http://127.0.0.1:5173). Default: Playwright starts both; to only use existing servers: E2E_SKIP_WEBSERVER=1`
    )

    const roomRes = await request.post(`${API_ORIGIN}/api/public/rooms`, {
      data: { title: 'Playwright room', timezone: 'UTC' },
    })
    expect(roomRes.ok()).toBeTruthy()
    const { room, controllerToken } = (await roomRes.json()) as {
      room: { id: string }
      controllerToken: string
    }

    const outRes = await request.post(`${API_ORIGIN}/api/rooms/${room.id}/outputs`, {
      data: { name: 'E2E Custom', type: 'CUSTOM' },
      headers: { [CONTROLLER_TOKEN_HEADER]: controllerToken },
    })
    expect(outRes.ok()).toBeTruthy()
    const output = (await outRes.json()) as { id: string; layout: unknown }
    expect(output.layout).toEqual(defaultCustomOutputLayout())

    const linkRes = await request.post(`${API_ORIGIN}/api/rooms/${room.id}/outputs/${output.id}/links`, {
      data: {},
      headers: { [CONTROLLER_TOKEN_HEADER]: controllerToken },
    })
    expect(linkRes.ok()).toBeTruthy()
    const linkJson = (await linkRes.json()) as { shortCode: string | null }
    test.skip(!linkJson.shortCode, 'Short code not returned')

    await page.goto(`/o/${encodeURIComponent(linkJson.shortCode!)}`)

    await expect(page.getByText('Connecting', { exact: false })).not.toBeVisible({ timeout: 45_000 })
    await expect(page.locator('body')).toContainText(/first timer/i, { timeout: 45_000 })
  })
})
