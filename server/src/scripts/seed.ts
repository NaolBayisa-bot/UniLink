import { pool } from '../db/pool';

// v1 keyword bank — grouped by category.
// Inserted with ON CONFLICT (name, category) DO NOTHING so the script is safe to re-run.
const KEYWORDS: Array<{ name: string; category: string }> = [
  // Music
  { name: 'Pop', category: 'Music' },
  { name: 'Rock', category: 'Music' },
  { name: 'Hip-Hop', category: 'Music' },
  { name: 'Jazz', category: 'Music' },
  { name: 'Classical', category: 'Music' },
  { name: 'Electronic', category: 'Music' },
  { name: 'Live Concerts', category: 'Music' },
  { name: 'Playing Guitar', category: 'Music' },
  { name: 'Singing', category: 'Music' },

  // Sports & Fitness
  { name: 'Gym', category: 'Sports & Fitness' },
  { name: 'Running', category: 'Sports & Fitness' },
  { name: 'Basketball', category: 'Sports & Fitness' },
  { name: 'Football', category: 'Sports & Fitness' },
  { name: 'Tennis', category: 'Sports & Fitness' },
  { name: 'Swimming', category: 'Sports & Fitness' },
  { name: 'Yoga', category: 'Sports & Fitness' },
  { name: 'Cycling', category: 'Sports & Fitness' },
  { name: 'Hiking', category: 'Sports & Fitness' },
  { name: 'Gaming & eSports', category: 'Sports & Fitness' },

  // Food & Drink
  { name: 'Coffee', category: 'Food & Drink' },
  { name: 'Street Food', category: 'Food & Drink' },
  { name: 'Cooking', category: 'Food & Drink' },
  { name: 'Baking', category: 'Food & Drink' },
  { name: 'Vegan', category: 'Food & Drink' },
  { name: 'Foodie', category: 'Food & Drink' },
  { name: 'Brunch', category: 'Food & Drink' },
  { name: 'Nightlife', category: 'Food & Drink' },

  // Entertainment
  { name: 'Movies', category: 'Entertainment' },
  { name: 'TV Series', category: 'Entertainment' },
  { name: 'Anime', category: 'Entertainment' },
  { name: 'Comedy', category: 'Entertainment' },
  { name: 'Board Games', category: 'Entertainment' },
  { name: 'Video Games', category: 'Entertainment' },
  { name: 'Reading', category: 'Entertainment' },
  { name: 'Concerts', category: 'Entertainment' },

  // Arts & Creativity
  { name: 'Photography', category: 'Arts & Creativity' },
  { name: 'Drawing', category: 'Arts & Creativity' },
  { name: 'Painting', category: 'Arts & Creativity' },
  { name: 'Writing', category: 'Arts & Creativity' },
  { name: 'Dance', category: 'Arts & Creativity' },
  { name: 'Theatre', category: 'Arts & Creativity' },
  { name: 'Graphic Design', category: 'Arts & Creativity' },
  { name: 'Crafting', category: 'Arts & Creativity' },

  // Academic & Career
  { name: 'Study Groups', category: 'Academic & Career' },
  { name: 'Programming', category: 'Academic & Career' },
  { name: 'Robotics', category: 'Academic & Career' },
  { name: 'AI & Machine Learning', category: 'Academic & Career' },
  { name: 'Career Networking', category: 'Academic & Career' },
  { name: 'Internships', category: 'Academic & Career' },
  { name: 'Startups', category: 'Academic & Career' },
  { name: 'Language Exchange', category: 'Academic & Career' },

  // Lifestyle & Values
  { name: 'Volunteering', category: 'Lifestyle & Values' },
  { name: 'Sustainability', category: 'Lifestyle & Values' },
  { name: 'Meditation', category: 'Lifestyle & Values' },
  { name: 'Minimalism', category: 'Lifestyle & Values' },
  { name: 'Travel', category: 'Lifestyle & Values' },
  { name: 'Fitness Goals', category: 'Lifestyle & Values' },
  { name: 'Reading Club', category: 'Lifestyle & Values' },

  // Social
  { name: 'Startup Networking', category: 'Social' },
  { name: 'Community Service', category: 'Social' },
  { name: 'Speed Friending', category: 'Social' },
  { name: 'Social Events', category: 'Social' },
  { name: 'Club Meetups', category: 'Social' },
  { name: 'Volunteer Groups', category: 'Social' },
];

async function seed(): Promise<void> {
  try {
    const values: unknown[] = [];
    const placeholders: string[] = [];
    for (let i = 0; i < KEYWORDS.length; i++) {
      const base = i * 2;
      placeholders.push(`($${base + 1}, $${base + 2})`);
      values.push(KEYWORDS[i].name, KEYWORDS[i].category);
    }

    const insertSql = `
      INSERT INTO keywords (name, category)
      VALUES ${placeholders.join(', ')}
      ON CONFLICT (name, category) DO NOTHING
    `;

    const insertResult = await pool.query(insertSql, values);
    console.log(`✅ Seeded ${KEYWORDS.length} keywords (${insertResult.rowCount} newly inserted).`);

    const countResult = await pool.query('SELECT COUNT(*) AS count FROM keywords');
    console.log(`📊 Total rows in keywords table: ${countResult.rows[0].count}`);
  } catch (error) {
    console.error('❌ Seed failed:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  } finally {
    await pool.end();
  }
}

seed();
