export interface SponsorDetails {
  name: string;
  level: string;
  logo: string;
  url: string;
  visible: boolean;
}

export interface Sponsor extends SponsorDetails {
  $key: string;
  order: number;
}

export function sponsorGroups(sponsors: Sponsor[]) {
  const groups = new Map<string, Sponsor[]>();
  for (const sponsor of [...sponsors].sort((a, b) => a.order - b.order)) {
    if (!sponsor.visible) continue;
    const list = groups.get(sponsor.level) ?? [];
    list.push(sponsor);
    groups.set(sponsor.level, list);
  }
  return Array.from(groups, ([level, sponsors]) => ({ level, sponsors }));
}

export function isSponsorWebsite(url: string) {
  return /^https?:\/\/[^\s\\]+$/.test(url) && URL.canParse(url);
}

export function isSponsorLogo(url: string) {
  return /^\/a\/images\/[^\s\\]+$/.test(url) || isSponsorWebsite(url);
}
