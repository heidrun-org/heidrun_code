import Fs from 'node:fs';
import Path from 'node:path';
import { describe, expect, it } from 'vitest';
import { IssueFixSkill } from '../src/issue_fix_skill.ts';

const __dirname = import.meta.dirname;

const repositoryPath = Path.resolve(__dirname, '..', '..', '..', '..');
const agentsFilePath = Path.join(repositoryPath, 'AGENTS.md');
const skillFolderPath = Path.join(repositoryPath, '.agents', 'skills', 'issue_fix_workflow');
const skillFilePath = Path.join(skillFolderPath, 'SKILL.md');
const claudeSkillLinkPath = Path.join(repositoryPath, '.claude', 'skills', 'issue_fix_workflow');

describe('IssueFixSkill', () => {
	describe('the real skill and the real AGENTS.md', () => {
		it('has a skill that names no detail of this repository', () => {
			const skillText = Fs.readFileSync(skillFilePath, 'utf8');
			expect(IssueFixSkill.findRepositoryDetails(skillText)).toEqual([]);
		});

		it('has a skill that names every value that AGENTS.md gives', () => {
			const skillText = Fs.readFileSync(skillFilePath, 'utf8');
			expect(IssueFixSkill.findValuesNotNamedBySkill(skillText)).toEqual([]);
		});

		it('has a skill with a template that gives every value, to paste in the file AGENTS.md of another repository', () => {
			const skillText = Fs.readFileSync(skillFilePath, 'utf8');
			expect(IssueFixSkill.findMissingValues(skillText)).toEqual([]);
		});

		it('has a skill that warns and stops when the values are missing', () => {
			const skillText = Fs.readFileSync(skillFilePath, 'utf8');
			expect(skillText).toContain('### When the values are missing');
			expect(skillText).toContain('The Issue Fix Workflow is not configured in this repository.');
			expect(skillText).toContain('Do not start the Issue Fix Setup.');
			expect(skillText).toContain('Never guess or silently apply a value');
			expect(skillText).toContain('during an issue fix, use only the configured values');
		});

		it('has a skill with the four parts of the Issue Fix Workflow', () => {
			const skillText = Fs.readFileSync(skillFilePath, 'utf8');
			for (const partName of ['Setup', 'Implementation', 'Review', 'Completion']) {
				expect(skillText).toContain(`### Issue Fix ${partName}`);
			}
		});

		it('has a section of values in AGENTS.md with every value', () => {
			const agentsText = Fs.readFileSync(agentsFilePath, 'utf8');
			expect(IssueFixSkill.findMissingValues(agentsText)).toEqual([]);
		});

		it('has a pointer to the skill in AGENTS.md, and no longer the full text of the workflow', () => {
			const agentsText = Fs.readFileSync(agentsFilePath, 'utf8');
			expect(agentsText).toContain('(.agents/skills/issue_fix_workflow/SKILL.md)');
			for (const partName of ['Setup', 'Implementation', 'Review', 'Completion']) {
				expect(agentsText).not.toContain(`### Issue Fix ${partName}`);
			}
		});

		it('has a link in the folder .claude/skills that leads to the skill', () => {
			expect(Fs.lstatSync(claudeSkillLinkPath).isSymbolicLink()).toBe(true);
			expect(Fs.realpathSync(claudeSkillLinkPath)).toBe(Fs.realpathSync(skillFolderPath));
		});
	});

	describe('findRepositoryDetails', () => {
		it('finds the name of a branch, a command, and a variable of one repository', () => {
			const details = IssueFixSkill.findRepositoryDetails(
				'Merge into dev_jerome. Run pnpm dev. Read CLAUDE_CODE_HOST_SESSION_ID. Use gh and glab.',
			);
			expect(details).toEqual(['dev_jerome', 'pnpm', 'gh', 'glab', 'CLAUDE_CODE_HOST_SESSION_ID']);
		});

		it('finds nothing in a general text', () => {
			expect(
				IssueFixSkill.findRepositoryDetails('Merge into the "Target branch". Use the "Launch command".'),
			).toEqual([]);
		});
	});

	describe('findMissingValues', () => {
		const completeText = [
			'## Issue Fix Workflow',
			'',
			'### Issue Fix Workflow values',
			'',
			...IssueFixSkill.valueNames.map((valueName) => {
				return `- ${valueName}: something.`;
			}),
			'',
			'## Next section',
			'',
		].join('\n');

		it('finds nothing when every value is given', () => {
			expect(IssueFixSkill.findMissingValues(completeText)).toEqual([]);
		});

		it('finds a value that is missing', () => {
			const text = completeText.replace('- Launch command: something.\n', '');
			expect(IssueFixSkill.findMissingValues(text)).toEqual(['Launch command']);
		});

		it('does not count a value that sits after the next heading', () => {
			const text = ['### Issue Fix Workflow values', '', '## Next section', '- Target branch: main.', ''].join('\n');
			expect(IssueFixSkill.findMissingValues(text)).toEqual([...IssueFixSkill.valueNames]);
		});

		it('finds every value when the section does not exist', () => {
			expect(IssueFixSkill.findMissingValues('# Rules\n')).toEqual([...IssueFixSkill.valueNames]);
		});
	});

	describe('findValuesNotNamedBySkill', () => {
		it('finds a value that the skill does not name between quotation marks', () => {
			const text = '"Target branch" "Worktree creation command" "Worktree folder" "Launch command" "Chat rename"';
			expect(IssueFixSkill.findValuesNotNamedBySkill(text)).toEqual(['Issue tracker commands']);
		});
	});
});
