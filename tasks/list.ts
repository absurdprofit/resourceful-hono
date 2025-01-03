import { parseArgs } from 'jsr:@std/cli@1.0.9/parse-args';
import { globToRegExp, isGlob, join } from 'jsr:@std/path@1.0.8';
import { exists, expandGlob } from 'jsr:@std/fs@1.0.8';
import DenoJSON from '../deno.json' with { type: 'json' };

async function exec(command: string, args: string[]) {
  const { stdout } = await new Deno.Command(command, { args }).output();
  return new TextDecoder().decode(stdout);
}

async function summaryFromPackage(path: string) {
  const denoJSONPath = join(path, 'deno.json');
  if (await exists(denoJSONPath)) {
    const denoJSON = JSON.parse(await Deno.readTextFile(denoJSONPath));
    return {
      name: denoJSON.name,
      version: denoJSON.version,
      path
    };
  }
  return null;
}

async function getAllPackages() {
  const list = [];
  for (const pattern of DenoJSON.workspace) {
    const entries = await Array.fromAsync(expandGlob(pattern));
    for (const { path } of entries.filter(entry => entry.isDirectory)) {
      list.push(await summaryFromPackage(path));
    }
  }

  return list.filter(Boolean);
}

async function getChangedPackages(sinceHash: string) {
  const output = await exec('git', ['diff', '--name-only', sinceHash]);
  const changedFilePaths = output.trim().split('\n');
  const list = [];

  for (const pattern of DenoJSON.workspace) {
    if (isGlob(pattern)) {
      const regex = new RegExp(
        globToRegExp(pattern)
          .source
          .replace(/\$$/, '') // remove end of line assertion
      );
      for (const path of changedFilePaths) {
        const [match] = regex.exec(path) ?? [];
        if (match) {
          list.push(
            await summaryFromPackage(
              join(
                Deno.cwd(),
                match.replace(/\/$/, '') // remove trailing slash
              )
            )
          );
          break;
        }
      }
    } else if (changedFilePaths.some(path => path.startsWith(pattern))) {
      list.push(await summaryFromPackage(pattern));
    }
  }

  return list.filter(Boolean);
}

async function main() {
  const args = parseArgs(Deno.args, {
    default: {
      since: undefined,
    },
    alias: {
      since: 's',
    },
  });
  
  const packages = args.since ? await getChangedPackages(args.since) : await getAllPackages();
  Deno.stdout.write(
    new TextEncoder().encode(
      JSON.stringify(packages, null, 2)
    )
  );
}

if (import.meta.main) {
  await main();

}
