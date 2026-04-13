import { PrismaClient, OutputType, TeamRole, Plan } from '../generated/prisma/index.js'
import { hash } from '@node-rs/argon2'

const prisma = new PrismaClient()

function hashPasswordSeed(password: string): Promise<string> {
  return hash(password, { memoryCost: 19_456, timeCost: 2, outputLen: 32, parallelism: 1 })
}

async function main() {
  console.log('🌱 Seeding database...')

  // Demo user
  const demoHash = await hashPasswordSeed('demo1234')
  const user = await prisma.user.upsert({
    where: { email: 'demo@cuepoint.local' },
    update: { passwordHash: demoHash },
    create: {
      email: 'demo@cuepoint.local',
      passwordHash: demoHash,
      name: 'Demo User',
      locale: 'en',
      theme: 'system',
    },
  })

  // Demo team
  const team = await prisma.team.upsert({
    where: { apiKey: 'team_demo_seed_key' },
    update: {},
    create: {
      name: 'Demo Team',
      plan: Plan.PRO,
      apiKey: 'team_demo_seed_key',
      members: {
        create: {
          userId: user.id,
          role: TeamRole.OWNER,
        },
      },
    },
  })

  // Demo room
  const room = await prisma.room.upsert({
    where: { apiKey: 'room_demo_seed_key' },
    update: {},
    create: {
      title: 'Demo Keynote',
      timezone: 'UTC',
      ownerId: user.id,
      teamId: team.id,
      apiKey: 'room_demo_seed_key',
      onAir: false,
      blackout: false,
    },
  })

  // Labels
  await prisma.label.upsert({
    where: { roomId_name: { roomId: room.id, name: 'Keynote' } },
    update: {},
    create: { roomId: room.id, name: 'Keynote', color: '#3b82f6' },
  })
  await prisma.label.upsert({
    where: { roomId_name: { roomId: room.id, name: 'Break' } },
    update: {},
    create: { roomId: room.id, name: 'Break', color: '#10b981' },
  })

  // Wipe-and-seed timers (simpler than diffing for dev)
  await prisma.timer.deleteMany({ where: { roomId: room.id } })
  await prisma.timer.createMany({
    data: [
      {
        roomId: room.id,
        order: 0,
        title: 'Welcome & Intro',
        speaker: 'Host',
        durationMs: 5 * 60 * 1000,
        wrapupYellowMs: 60_000,
        wrapupRedMs: 15_000,
      },
      {
        roomId: room.id,
        order: 1,
        title: 'Keynote',
        speaker: 'Jane Doe',
        durationMs: 30 * 60 * 1000,
        wrapupYellowMs: 3 * 60_000,
        wrapupRedMs: 60_000,
        wrapupFlash: true,
      },
      {
        roomId: room.id,
        order: 2,
        title: 'Break',
        durationMs: 10 * 60 * 1000,
      },
      {
        roomId: room.id,
        order: 3,
        title: 'Q & A',
        speaker: 'Panel',
        durationMs: 15 * 60 * 1000,
      },
    ],
  })

  // Messages
  await prisma.message.deleteMany({ where: { roomId: room.id } })
  await prisma.message.createMany({
    data: [
      { roomId: room.id, text: 'Please stand by', color: 'white', order: 0 },
      { roomId: room.id, text: 'Wrap up soon', color: 'red', flash: true, order: 1 },
    ],
  })

  // Default Viewer output
  await prisma.output.deleteMany({ where: { roomId: room.id } })
  await prisma.output.create({
    data: {
      roomId: room.id,
      name: 'Main Viewer',
      type: OutputType.VIEWER,
      layout: {},
    },
  })

  // SubmitQuestion config
  await prisma.submitQuestionConfig.upsert({
    where: { roomId: room.id },
    update: {},
    create: {
      roomId: room.id,
      enabled: true,
      title: 'Ask a question',
      subtitle: 'Your question will be reviewed before showing on screen.',
      questionLabel: 'Your question',
      nameLabel: 'Your name',
    },
  })

  console.log('✅ Seed complete')
  console.log(`   user:  demo@cuepoint.local / demo1234`)
  console.log(`   room:  ${room.id} (${room.title})`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
