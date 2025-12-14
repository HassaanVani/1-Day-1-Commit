interface Repo {
    id: number;
    name: string;
    full_name: string;
    description: string | null;
    html_url: string;
    pushed_at: string;
    updated_at: string;
    language: string | null;
    stargazers_count: number;
    open_issues_count: number;
    private: boolean;
}

export class GitHubService {
    private token: string;
    private baseUrl = 'https://api.github.com';

    constructor(token: string) {
        this.token = token;
    }

    private async fetch(endpoint: string, options: RequestInit = {}) {
        const response = await fetch(`${this.baseUrl}${endpoint}`, {
            ...options,
            headers: {
                'Authorization': `Bearer ${this.token}`,
                'Accept': 'application/vnd.github.v3+json',
                ...options.headers
            }
        });

        if (!response.ok) {
            throw new Error(`GitHub API error: ${response.status}`);
        }

        return response.json();
    }

    async getUserRepos(): Promise<Repo[]> {
        const repos = await this.fetch('/user/repos?sort=pushed&per_page=100&affiliation=owner,collaborator');
        return repos;
    }

    async hasCommittedToday(username: string): Promise<{ hasCommitted: boolean; commitCount: number }> {
        const today = new Date().toISOString().split('T')[0];

        try {
            // Get user events
            const events = await this.fetch(`/users/${username}/events?per_page=100`);

            // Filter for push events today
            const todayPushEvents = events.filter((event: any) => {
                if (event.type !== 'PushEvent') return false;
                const eventDate = new Date(event.created_at).toISOString().split('T')[0];
                return eventDate === today;
            });

            // Count commits
            let commitCount = 0;
            for (const event of todayPushEvents) {
                commitCount += event.payload?.commits?.length || 0;
            }

            return {
                hasCommitted: commitCount > 0,
                commitCount
            };
        } catch (error) {
            console.error('Error checking today commits:', error);
            return { hasCommitted: false, commitCount: 0 };
        }
    }

    async getSuggestion(repos: Repo[], excludedRepos: string[]): Promise<Repo | null> {
        // Filter out excluded repos
        const eligibleRepos = repos.filter(repo => !excludedRepos.includes(repo.full_name));

        if (eligibleRepos.length === 0) return null;

        // Score repos based on:
        // 1. Days since last push (higher = more neglected = higher priority)
        // 2. Open issues count (more issues = more work to do)
        const now = new Date();

        const scoredRepos = eligibleRepos.map(repo => {
            const lastPush = new Date(repo.pushed_at);
            const daysSinceLastPush = Math.floor((now.getTime() - lastPush.getTime()) / (1000 * 60 * 60 * 24));

            // Score formula: days since push * 2 + open issues (capped at 10)
            const score = (daysSinceLastPush * 2) + Math.min(repo.open_issues_count, 10);

            return { repo, score, daysSinceLastPush };
        });

        // Sort by score (highest first)
        scoredRepos.sort((a, b) => b.score - a.score);

        // Return top suggestion with additional info
        const top = scoredRepos[0];
        return {
            ...top.repo,
            daysSinceLastPush: top.daysSinceLastPush
        } as any;
    }

    async getContributions(username: string): Promise<any[]> {
        // Get recent events and group by date
        const events = await this.fetch(`/users/${username}/events?per_page=100`);

        // Group push events by date
        const contributions: Record<string, number> = {};

        for (const event of events) {
            if (event.type === 'PushEvent') {
                const date = new Date(event.created_at).toISOString().split('T')[0];
                const commits = event.payload?.commits?.length || 0;
                contributions[date] = (contributions[date] || 0) + commits;
            }
        }

        // Convert to array format
        return Object.entries(contributions).map(([date, count]) => ({
            date,
            count
        }));
    }
}
