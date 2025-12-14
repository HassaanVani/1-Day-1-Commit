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

interface ContributionDay {
    date: string;
    count: number;
}

export class GitHubService {
    private token: string;
    private baseUrl = 'https://api.github.com';
    private graphqlUrl = 'https://api.github.com/graphql';

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
            const text = await response.text();
            console.error(`GitHub API error: ${response.status}`, text);
            throw new Error(`GitHub API error: ${response.status}`);
        }

        return response.json();
    }

    private async graphql(query: string, variables: Record<string, any> = {}) {
        const response = await fetch(this.graphqlUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ query, variables })
        });

        if (!response.ok) {
            const text = await response.text();
            console.error(`GitHub GraphQL error: ${response.status}`, text);
            throw new Error(`GitHub GraphQL error: ${response.status}`);
        }

        const data = await response.json();
        if (data.errors) {
            console.error('GraphQL errors:', data.errors);
            throw new Error(data.errors[0]?.message || 'GraphQL error');
        }

        return data.data;
    }

    async getUserRepos(): Promise<Repo[]> {
        const repos = await this.fetch('/user/repos?sort=pushed&per_page=100&affiliation=owner,collaborator');
        return repos;
    }

    async hasCommittedToday(username: string): Promise<{ hasCommitted: boolean; commitCount: number }> {
        const today = new Date().toISOString().split('T')[0];

        try {
            // Use GraphQL to get today's contributions accurately
            const query = `
                query($username: String!, $from: DateTime!, $to: DateTime!) {
                    user(login: $username) {
                        contributionsCollection(from: $from, to: $to) {
                            totalCommitContributions
                            contributionCalendar {
                                weeks {
                                    contributionDays {
                                        date
                                        contributionCount
                                    }
                                }
                            }
                        }
                    }
                }
            `;

            const todayStart = new Date(today);
            const todayEnd = new Date(today);
            todayEnd.setHours(23, 59, 59, 999);

            const data = await this.graphql(query, {
                username,
                from: todayStart.toISOString(),
                to: todayEnd.toISOString()
            });

            const commitCount = data.user?.contributionsCollection?.totalCommitContributions || 0;

            return {
                hasCommitted: commitCount > 0,
                commitCount
            };
        } catch (error) {
            console.error('Error checking today commits via GraphQL, falling back to events API:', error);

            // Fallback to events API
            try {
                const events = await this.fetch(`/users/${username}/events?per_page=100`);
                const todayPushEvents = events.filter((event: any) => {
                    if (event.type !== 'PushEvent') return false;
                    const eventDate = new Date(event.created_at).toISOString().split('T')[0];
                    return eventDate === today;
                });

                let commitCount = 0;
                for (const event of todayPushEvents) {
                    commitCount += event.payload?.commits?.length || 0;
                }

                return { hasCommitted: commitCount > 0, commitCount };
            } catch (fallbackError) {
                console.error('Fallback also failed:', fallbackError);
                return { hasCommitted: false, commitCount: 0 };
            }
        }
    }

    async getContributions(username: string): Promise<ContributionDay[]> {
        try {
            // Use GraphQL to get the actual contribution calendar
            const query = `
                query($username: String!) {
                    user(login: $username) {
                        contributionsCollection {
                            contributionCalendar {
                                totalContributions
                                weeks {
                                    contributionDays {
                                        date
                                        contributionCount
                                    }
                                }
                            }
                        }
                    }
                }
            `;

            const data = await this.graphql(query, { username });
            const weeks = data.user?.contributionsCollection?.contributionCalendar?.weeks || [];

            // Flatten weeks into days
            const contributions: ContributionDay[] = [];
            for (const week of weeks) {
                for (const day of week.contributionDays) {
                    contributions.push({
                        date: day.date,
                        count: day.contributionCount
                    });
                }
            }

            // Return full contribution history (usually 1 year)
            return contributions;
        } catch (error: any) {
            console.error('Error fetching contributions via GraphQL:', error?.message);
            if (error?.response) {
                console.error('GraphQL Response Error:', JSON.stringify(error.response));
            }

            // Fallback: use events API and fill in missing dates
            console.log('Falling back to Events API (Limited Data)...');
            try {
                const events = await this.fetch(`/users/${username}/events?per_page=100`);
                const contributionMap: Record<string, number> = {};

                for (const event of events) {
                    if (event.type === 'PushEvent') {
                        const date = new Date(event.created_at).toISOString().split('T')[0];
                        const commits = event.payload?.commits?.length || 0;
                        contributionMap[date] = (contributionMap[date] || 0) + commits;
                    }
                }

                // Generate last 365 days for fallback so grid looks full (but empty)
                const contributions: ContributionDay[] = [];
                const today = new Date();
                for (let i = 364; i >= 0; i--) {
                    const d = new Date(today);
                    d.setDate(d.getDate() - i);
                    const dateStr = d.toISOString().split('T')[0];
                    contributions.push({
                        date: dateStr,
                        count: contributionMap[dateStr] || 0
                    });
                }
                return contributions;
            } catch (fallbackError) {
                console.error('Fallback also failed:', fallbackError);
                return [];
            }
        }
    }


    async getCurrentStreak(username: string): Promise<{ currentStreak: number; longestStreak: number }> {
        try {
            const contributions = await this.getContributions(username);

            // Calculate current streak from contributions
            let currentStreak = 0;
            let longestStreak = 0;
            let tempStreak = 0;

            // Sort by date descending to calculate current streak
            const sorted = [...contributions].sort((a, b) =>
                new Date(b.date).getTime() - new Date(a.date).getTime()
            );

            // Check if today or yesterday had a contribution (allow for timezone differences)
            const today = new Date().toISOString().split('T')[0];
            const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

            // Find current streak
            let streakBroken = false;
            for (let i = 0; i < sorted.length && !streakBroken; i++) {
                const day = sorted[i];
                if (day.count > 0) {
                    // Check if this continues the streak
                    if (i === 0) {
                        // First day - must be today or yesterday
                        if (day.date === today || day.date === yesterday) {
                            currentStreak = 1;
                        }
                    } else {
                        // Check if consecutive with previous counted day
                        const prevDate = new Date(sorted[i - 1].date);
                        const currDate = new Date(day.date);
                        const diffDays = Math.floor((prevDate.getTime() - currDate.getTime()) / 86400000);

                        if (diffDays === 1) {
                            currentStreak++;
                        } else {
                            streakBroken = true;
                        }
                    }
                } else if (i === 0 && day.date === today) {
                    // Today has no contributions yet, check yesterday
                    continue;
                } else if (currentStreak > 0) {
                    streakBroken = true;
                }
            }

            // Calculate longest streak by going through all contributions chronologically
            const chronological = [...contributions].sort((a, b) =>
                new Date(a.date).getTime() - new Date(b.date).getTime()
            );

            for (let i = 0; i < chronological.length; i++) {
                if (chronological[i].count > 0) {
                    if (i === 0) {
                        tempStreak = 1;
                    } else {
                        const prevDate = new Date(chronological[i - 1].date);
                        const currDate = new Date(chronological[i].date);
                        const diffDays = Math.floor((currDate.getTime() - prevDate.getTime()) / 86400000);

                        if (diffDays === 1 && chronological[i - 1].count > 0) {
                            tempStreak++;
                        } else {
                            tempStreak = 1;
                        }
                    }
                    longestStreak = Math.max(longestStreak, tempStreak);
                } else {
                    tempStreak = 0;
                }
            }

            return { currentStreak, longestStreak };
        } catch (error) {
            console.error('Error calculating streak:', error);
            return { currentStreak: 0, longestStreak: 0 };
        }
    }

    async getSuggestion(
        repos: Repo[],
        excludedRepos: string[],
        repoNotes?: Map<string, { priority?: number; difficulty?: number }>
    ): Promise<(Repo & { daysSinceLastPush: number; score: number }) | null> {
        // Filter out excluded repos
        const eligibleRepos = repos.filter(repo => !excludedRepos.includes(repo.full_name));

        if (eligibleRepos.length === 0) return null;

        const now = new Date();

        const scoredRepos = eligibleRepos.map(repo => {
            const lastPush = new Date(repo.pushed_at);
            const daysSinceLastPush = Math.floor((now.getTime() - lastPush.getTime()) / (1000 * 60 * 60 * 24));

            // Get user notes if available
            const notes = repoNotes?.get(repo.full_name);
            const priority = notes?.priority || 3; // Default to medium priority
            const difficulty = notes?.difficulty || 3; // Default to medium difficulty

            // Weighted scoring:
            // - Days since push: 30% (normalized to 0-100, capped at 365 days)
            // - Open issues: 20% (normalized to 0-100, capped at 50 issues)
            // - User priority: 25% (1-5 scaled to 0-100)
            // - Inverse difficulty: 15% (easier = higher score)
            // - Random: 10%

            const dayScore = Math.min(daysSinceLastPush / 365, 1) * 100 * 0.30;
            const issueScore = Math.min(repo.open_issues_count / 50, 1) * 100 * 0.20;
            const priorityScore = (priority / 5) * 100 * 0.25;
            const difficultyScore = ((6 - difficulty) / 5) * 100 * 0.15;
            const randomScore = Math.random() * 100 * 0.10;

            const score = dayScore + issueScore + priorityScore + difficultyScore + randomScore;

            return {
                repo: { ...repo, daysSinceLastPush, score },
                score
            };
        });

        // Sort by score (highest first)
        scoredRepos.sort((a, b) => b.score - a.score);

        return scoredRepos[0].repo;
    }
}
