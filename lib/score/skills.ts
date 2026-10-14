import { normalizeForMatch, tokenize } from './text';

export interface SkillEntry {
  name: string;
  aliases?: string[];
  /** Common English words (Go, React, Swift…): in long text only matched with exact capitalization. */
  ambiguous?: boolean;
  /** Category satisfied by having any of these skills, e.g. "SQL" by "PostgreSQL". */
  impliedBy?: string[];
}

export const SKILLS: SkillEntry[] = [
  // Languages
  { name: 'Python' },
  { name: 'Java' },
  { name: 'JavaScript', aliases: ['JS', 'ECMAScript'] },
  { name: 'TypeScript' },
  { name: 'Go', aliases: ['Golang'], ambiguous: true },
  { name: 'Rust', ambiguous: true },
  { name: 'C++', aliases: ['cpp'] },
  { name: 'C#', aliases: ['csharp', 'c sharp'] },
  { name: 'C', ambiguous: true },
  { name: 'Ruby', ambiguous: true },
  { name: 'PHP' },
  { name: 'Kotlin' },
  { name: 'Swift', ambiguous: true },
  { name: 'Scala' },
  { name: 'R', ambiguous: true },
  { name: 'Bash', aliases: ['shell scripting'] },
  { name: 'SQL', impliedBy: ['PostgreSQL', 'MySQL', 'SQL Server', 'Oracle Database', 'SQLite', 'Snowflake', 'BigQuery', 'Redshift'] },
  // Frameworks and libraries
  { name: 'React', aliases: ['React.js', 'ReactJS'], ambiguous: true },
  { name: 'Angular', aliases: ['AngularJS'] },
  { name: 'Vue', aliases: ['Vue.js', 'VueJS'] },
  { name: 'Svelte' },
  { name: 'Next.js', aliases: ['NextJS'] },
  { name: 'Node.js', aliases: ['NodeJS', 'Node'], ambiguous: true },
  { name: 'Express', aliases: ['Express.js'], ambiguous: true },
  { name: 'Django' },
  { name: 'Flask' },
  { name: 'FastAPI' },
  { name: 'Spring', aliases: ['Spring Boot'], ambiguous: true },
  { name: '.NET', aliases: ['dotnet', 'ASP.NET', '.NET Core'] },
  { name: 'Rails', aliases: ['Ruby on Rails'] },
  { name: 'SwiftUI' },
  { name: 'Combine', ambiguous: true },
  { name: 'Flutter' },
  { name: 'React Native' },
  { name: 'GraphQL' },
  { name: 'REST', aliases: ['RESTful', 'REST API', 'REST APIs'], ambiguous: true },
  { name: 'gRPC' },
  { name: 'Frontend framework', aliases: ['frontend frameworks', 'front end framework'], impliedBy: ['React', 'Angular', 'Vue', 'Svelte', 'Next.js'] },
  // Data and ML
  { name: 'PostgreSQL', aliases: ['Postgres', 'psql'] },
  { name: 'MySQL' },
  { name: 'SQL Server', aliases: ['MSSQL', 'T-SQL'] },
  { name: 'Oracle Database', aliases: ['Oracle DB', 'PL/SQL'] },
  { name: 'SQLite' },
  { name: 'MongoDB', aliases: ['Mongo'] },
  { name: 'Cassandra' },
  { name: 'DynamoDB' },
  { name: 'Redis' },
  { name: 'Elasticsearch', aliases: ['Elastic Search', 'OpenSearch'] },
  { name: 'NoSQL', impliedBy: ['MongoDB', 'Cassandra', 'DynamoDB', 'Redis', 'Cosmos DB'] },
  { name: 'Cosmos DB', aliases: ['CosmosDB'] },
  { name: 'Snowflake', ambiguous: true },
  { name: 'BigQuery' },
  { name: 'Redshift' },
  { name: 'Databricks' },
  { name: 'Spark', aliases: ['Apache Spark', 'PySpark'], ambiguous: true },
  { name: 'Kafka', aliases: ['Apache Kafka'] },
  { name: 'Airflow', aliases: ['Apache Airflow'] },
  { name: 'dbt' },
  { name: 'ETL', aliases: ['ELT', 'data pipelines', 'data pipeline'] },
  { name: 'Pandas' },
  { name: 'NumPy' },
  { name: 'PyTorch', aliases: ['Torch'] },
  { name: 'TensorFlow' },
  { name: 'Keras' },
  { name: 'scikit-learn', aliases: ['sklearn', 'scikit learn'] },
  { name: 'Machine learning', aliases: ['ML'], impliedBy: ['PyTorch', 'TensorFlow', 'scikit-learn', 'Keras'] },
  { name: 'Deep learning' },
  { name: 'NLP', aliases: ['natural language processing'] },
  { name: 'Computer vision' },
  { name: 'LLM', aliases: ['LLMs', 'large language models', 'large language model'] },
  { name: 'Generative AI', aliases: ['GenAI', 'gen ai'] },
  { name: 'Tableau' },
  { name: 'Power BI', aliases: ['PowerBI'] },
  { name: 'Looker' },
  { name: 'BI tools', aliases: ['BI tool', 'BI', 'business intelligence'], impliedBy: ['Tableau', 'Power BI', 'Looker'] },
  { name: 'Excel', aliases: ['Microsoft Excel', 'MS Excel'], ambiguous: true },
  // Cloud and DevOps
  { name: 'AWS', aliases: ['Amazon Web Services'] },
  { name: 'Azure', aliases: ['Microsoft Azure'] },
  { name: 'GCP', aliases: ['Google Cloud', 'Google Cloud Platform'] },
  { name: 'Cloud', aliases: ['cloud platform', 'public cloud', 'major cloud'], impliedBy: ['AWS', 'Azure', 'GCP'] },
  { name: 'Docker' },
  { name: 'Kubernetes', aliases: ['k8s', 'AKS', 'EKS', 'GKE'] },
  { name: 'Containers', aliases: ['containerization'], impliedBy: ['Docker', 'Kubernetes'] },
  { name: 'Terraform' },
  { name: 'Ansible' },
  { name: 'Helm' },
  { name: 'Jenkins' },
  { name: 'GitHub Actions' },
  { name: 'GitLab CI', aliases: ['GitLab CI/CD'] },
  { name: 'Azure DevOps' },
  { name: 'Argo CD', aliases: ['ArgoCD'] },
  {
    name: 'CI/CD',
    aliases: ['CICD', 'continuous integration', 'continuous delivery', 'continuous deployment'],
    impliedBy: ['Jenkins', 'GitHub Actions', 'GitLab CI', 'Azure DevOps', 'Argo CD'],
  },
  { name: 'Linux', aliases: ['Unix'] },
  { name: 'Git', aliases: ['GitHub', 'GitLab'] },
  { name: 'Prometheus' },
  { name: 'Grafana' },
  { name: 'Microservices', aliases: ['microservice', 'micro services'] },
  // Practices and degrees
  { name: 'Agile', aliases: ['Scrum', 'Kanban'] },
  { name: 'Unit testing', aliases: ['unit tests', 'TDD', 'test driven development'] },
  { name: "Bachelor's degree", aliases: ['Bachelors', 'Bachelor', 'BS', 'B.S', 'BSc', 'B.Sc', 'BA', 'B.A', 'BE', 'B.E', 'BTech', 'B.Tech', 'undergraduate degree'], ambiguous: true, impliedBy: ["Master's degree", 'PhD'] },
  { name: "Master's degree", aliases: ['Masters', 'Master', 'MS', 'M.S', 'MSc', 'M.Sc', 'MTech', 'M.Tech', 'MBA'], ambiguous: true, impliedBy: ['PhD'] },
  { name: 'PhD', aliases: ['Ph.D', 'doctorate'] },
];

interface Compiled {
  entry: SkillEntry;
  phrases: string[];
  caseSensitive: RegExp[];
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const COMPILED: Compiled[] = SKILLS.map((entry) => {
  const forms = [entry.name, ...(entry.aliases ?? [])];
  return {
    entry,
    phrases: [...new Set(forms.map((f) => tokenize(f).join(' ')).filter(Boolean))],
    caseSensitive: entry.ambiguous
      ? forms.map((f) => new RegExp(`(^|[\\s,;:(/])${escapeRe(f)}(?=$|[\\s,;:.)/'’])`))
      : [],
  };
});

const BY_NAME = new Map(SKILLS.map((s) => [s.name, s]));

/**
 * Finds known skills in text. Short items (a skills-list entry or one requirement) match ambiguous
 * names case-insensitively; long prose only matches them with exact capitalization.
 */
export function findSkills(text: string, mode: 'short' | 'long' = tokenize(text).length <= 8 ? 'short' : 'long'): Set<string> {
  const norm = normalizeForMatch(text);
  const found = new Set<string>();
  for (const c of COMPILED) {
    const hit =
      c.entry.ambiguous && mode === 'long'
        ? c.caseSensitive.some((re) => re.test(text))
        : c.phrases.some((p) => norm.includes(` ${p} `));
    if (hit) found.add(c.entry.name);
  }
  return found;
}

/** Adds categories implied by concrete skills (PostgreSQL ⇒ SQL, PhD ⇒ Master's ⇒ Bachelor's). */
export function withImplied(skills: Set<string>): Set<string> {
  const out = new Set(skills);
  let changed = true;
  while (changed) {
    changed = false;
    for (const s of SKILLS) {
      if (!out.has(s.name) && s.impliedBy?.some((i) => out.has(i))) {
        out.add(s.name);
        changed = true;
      }
    }
  }
  return out;
}

export const isCategory = (name: string) => !!BY_NAME.get(name)?.impliedBy?.length;
