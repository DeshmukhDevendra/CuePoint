import { describe, it, expect, afterAll } from 'vitest'
import request from 'supertest'
import type { Server as SocketIOServer } from 'socket.io'
import { prisma } from '@cuepoint/db'
import { CONTROLLER_TOKEN_HEADER, defaultCustomOutputLayout } from '@cuepoint/shared'
import { createCuepointAppBundle } from '../../src/createExpressApp.js'

let dbOk = false
try {
  await prisma.$queryRaw`SELECT 1`
  dbOk = true
} catch {
  dbOk = false
}

afterAll(async () => {
  await prisma.$disconnect().catch(() => {})
})

function agent() {
  const { app, registerRealtimeRoutes } = createCuepointAppBundle()
  const mockIo = { to: () => ({ emit: () => undefined }) } as unknown as SocketIOServer
  registerRealtimeRoutes(mockIo)
  return request(app)
}

describe.skipIf(!dbOk)('API integration: outputs + public output-links', () => {
  const createdRoomIds: string[] = []

  afterAll(async () => {
    for (const id of createdRoomIds) {
      await prisma.room.delete({ where: { id } }).catch(() => {})
    }
  })

  it('creates CUSTOM output with default layout; GET + PATCH layout; link resolve returns output metadata', async () => {
    const req = agent()

    const roomRes = await req.post('/api/public/rooms').send({ title: 'Vitest room', timezone: 'UTC' })
    expect(roomRes.status).toBe(201)
    const { room, controllerToken } = roomRes.body as {
      room: { id: string }
      controllerToken: string
    }
    createdRoomIds.push(room.id)

    const headers = { [CONTROLLER_TOKEN_HEADER]: controllerToken }

    const createOut = await req
      .post(`/api/rooms/${room.id}/outputs`)
      .set(headers)
      .send({ name: 'Custom A', type: 'CUSTOM' })
    expect(createOut.status).toBe(201)
    const output = createOut.body as { id: string; type: string; layout: unknown }
    expect(output.type).toBe('CUSTOM')
    expect(output.layout).toEqual(defaultCustomOutputLayout())

    const getOut = await req.get(`/api/rooms/${room.id}/outputs/${output.id}`).set(headers)
    expect(getOut.status).toBe(200)
    expect((getOut.body as { type: string }).type).toBe('CUSTOM')

    const patchedLayout = {
      ...defaultCustomOutputLayout(),
      background: '#010203',
    }
    const patch = await req
      .patch(`/api/rooms/${room.id}/outputs/${output.id}`)
      .set(headers)
      .send({ layout: patchedLayout })
    expect(patch.status).toBe(200)
    expect((patch.body as { layout: { background: string } }).layout.background).toBe('#010203')

    const badPatch = await req
      .patch(`/api/rooms/${room.id}/outputs/${output.id}`)
      .set(headers)
      .send({ layout: { version: 99, elements: [] } })
    expect(badPatch.status).toBe(400)

    const linkRes = await req
      .post(`/api/rooms/${room.id}/outputs/${output.id}/links`)
      .set(headers)
      .send({})
    expect(linkRes.status).toBe(201)
    const shortCode = (linkRes.body as { shortCode: string | null }).shortCode
    expect(shortCode).toBeTruthy()

    const resolve = await req.get(`/api/public/output-links/short/${encodeURIComponent(shortCode!)}`)
    expect(resolve.status).toBe(200)
    const body = resolve.body as {
      room: { id: string }
      output: { type: string; layout: { background: string } }
    }
    expect(body.room.id).toBe(room.id)
    expect(body.output.type).toBe('CUSTOM')
    expect(body.output.layout.background).toBe('#010203')
  })

  it('creates output link with options; short-link resolve returns same options', async () => {
    const req = agent()
    const roomRes = await req.post('/api/public/rooms').send({ title: 'Opts room', timezone: 'UTC' })
    expect(roomRes.status).toBe(201)
    const { room, controllerToken } = roomRes.body as { room: { id: string }; controllerToken: string }
    createdRoomIds.push(room.id)
    const headers = { [CONTROLLER_TOKEN_HEADER]: controllerToken }

    const createOut = await req
      .post(`/api/rooms/${room.id}/outputs`)
      .set(headers)
      .send({ name: 'With opts', type: 'VIEWER' })
    expect(createOut.status).toBe(201)
    const output = createOut.body as { id: string }

    const linkRes = await req
      .post(`/api/rooms/${room.id}/outputs/${output.id}/links`)
      .set(headers)
      .send({
        options: {
          identifier: 'Downstage',
          mirror: true,
          delaySec: 7,
          timezone: 'Europe/Berlin',
          hideControls: true,
        },
      })
    expect(linkRes.status).toBe(201)
    const shortCode = (linkRes.body as { shortCode: string | null }).shortCode
    expect(shortCode).toBeTruthy()

    const resolve = await req.get(`/api/public/output-links/short/${encodeURIComponent(shortCode!)}`)
    expect(resolve.status).toBe(200)
    const body = resolve.body as { options: Record<string, unknown> }
    expect(body.options).toMatchObject({
      identifier: 'Downstage',
      mirror: true,
      delaySec: 7,
      timezone: 'Europe/Berlin',
      hideControls: true,
    })
  })

  it('POST import-layout copies layout JSON from another output in the same room', async () => {
    const req = agent()
    const roomRes = await req.post('/api/public/rooms').send({ title: 'Import layout room', timezone: 'UTC' })
    expect(roomRes.status).toBe(201)
    const { room, controllerToken } = roomRes.body as { room: { id: string }; controllerToken: string }
    createdRoomIds.push(room.id)
    const headers = { [CONTROLLER_TOKEN_HEADER]: controllerToken }

    const createA = await req
      .post(`/api/rooms/${room.id}/outputs`)
      .set(headers)
      .send({ name: 'Custom Source', type: 'CUSTOM' })
    expect(createA.status).toBe(201)
    const outA = createA.body as { id: string; layout: { background: string } }

    const layoutFromA = { ...defaultCustomOutputLayout(), background: '#aabbcc' }
    const patchA = await req
      .patch(`/api/rooms/${room.id}/outputs/${outA.id}`)
      .set(headers)
      .send({ layout: layoutFromA })
    expect(patchA.status).toBe(200)

    const createB = await req
      .post(`/api/rooms/${room.id}/outputs`)
      .set(headers)
      .send({ name: 'Custom Target', type: 'CUSTOM' })
    expect(createB.status).toBe(201)
    const outB = createB.body as { id: string; layout: { background: string } }
    expect(outB.layout.background).not.toBe('#aabbcc')

    const imp = await req
      .post(`/api/rooms/${room.id}/outputs/${outB.id}/import-layout`)
      .set(headers)
      .send({ fromOutputId: outA.id })
    expect(imp.status).toBe(200)
    expect((imp.body as { layout: { background: string } }).layout.background).toBe('#aabbcc')

    const getB = await req.get(`/api/rooms/${room.id}/outputs/${outB.id}`).set(headers)
    expect(getB.status).toBe(200)
    expect((getB.body as { layout: { background: string } }).layout.background).toBe('#aabbcc')
  })

  it('VIEWER output link resolve still includes output wire with raw layout', async () => {
    const req = agent()
    const roomRes = await req.post('/api/public/rooms').send({})
    expect(roomRes.status).toBe(201)
    const { room, controllerToken } = roomRes.body as { room: { id: string }; controllerToken: string }
    createdRoomIds.push(room.id)
    const headers = { [CONTROLLER_TOKEN_HEADER]: controllerToken }

    const createOut = await req
      .post(`/api/rooms/${room.id}/outputs`)
      .set(headers)
      .send({ name: 'Main', type: 'VIEWER' })
    expect(createOut.status).toBe(201)
    const output = createOut.body as { id: string; type: string }

    const linkRes = await req
      .post(`/api/rooms/${room.id}/outputs/${output.id}/links`)
      .set(headers)
      .send({})
    const shortCode = (linkRes.body as { shortCode: string | null }).shortCode
    expect(shortCode).toBeTruthy()

    const resolve = await req.get(`/api/public/output-links/short/${encodeURIComponent(shortCode!)}`)
    expect(resolve.status).toBe(200)
    const body = resolve.body as { output: { type: string; layout: unknown } }
    expect(body.output.type).toBe('VIEWER')
    expect(body.output.layout).toBeDefined()
  })
})
