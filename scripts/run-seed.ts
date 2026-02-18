import { seedAgents } from '../lib/db-seed';

async function main() {
    try {
        await seedAgents();
        process.exit(0);
    } catch (error) {
        console.error('Failed to seed agents:', error);
        process.exit(1);
    }
}

main();
