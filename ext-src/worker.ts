// @ts-ignore
import * as solc from "solc";
import * as path from "path";
import * as fs from "fs";
import axios from "axios";
// import { runTestSources } from 'remix-tests';
import { RemixURLResolver } from "remix-url-resolver";
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';

const PROTO_PATH = path.join(__dirname, '../services/greet.proto');
const packageDefinition = protoLoader.loadSync(PROTO_PATH,
  {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true
  }
);
const protoDescriptor = grpc.loadPackageDefinition(packageDefinition) as any;
const remix_tests_pb = protoDescriptor.remix_tests;
const remix_tests_client = new remix_tests_pb.RemixTestsService('127.0.0.1:50051', grpc.credentials.createInsecure());

function handleLocal(pathString: string, filePath: any) {
  // if no relative/absolute path given then search in node_modules folder
  if (
    pathString &&
    pathString.indexOf(".") !== 0 &&
    pathString.indexOf("/") !== 0
  ) {
    // return handleNodeModulesImport(pathString, filePath, pathString)
    return;
  } else {
    const o = { encoding: "UTF-8" };
    const p = pathString
      ? path.resolve(pathString, filePath)
      : path.resolve(pathString, filePath);
    const content = fs.readFileSync(p, o);
    return content;
  }
}

function findImports(path: any) {
  // TODO: We need current solc file path here for relative local import
  // @ts-ignore
  process.send({ processMessage: "importing file: " + path });
  const FSHandler = [
    {
      type: "local",
      match: (url: string) => {
        return /(^(?!(?:http:\/\/)|(?:https:\/\/)?(?:www.)?(?:github.com)))(^\/*[\w+-_/]*\/)*?(\w+\.sol)/g.exec(
          url
        );
      },
      handle: (match: Array<string>) => {
        return handleLocal(match[2], match[3]);
      }
    }
  ];
  // @ts-ignore
  const urlResolver = new RemixURLResolver();
  urlResolver
    .resolve(path, FSHandler)
    .then((data: any) => {
      // @ts-ignore
      process.send({ data, path });
    })
    .catch((e: Error) => {
      throw e;
    });
}

function _testCallback(result: any) {
  try {
      // @ts-ignore
      process.send({ _testCallback: '_testCallback', result });
  } catch (e) {
      // @ts-ignore
      process.send({ error: e });
  }
}
function _resultsCallback(e: Error, result: any) {
  if(e) {
      // @ts-ignore
      process.send({ error: e });
  }
  // @ts-ignore
  process.send({ _resultsCallback: '_resultsCallback', result });
}
function _finalCallback(e: Error, result: any) {
  if(e) {
      // @ts-ignore
      process.send({ error: e });
  }
  // @ts-ignore
  process.send({ _finalCallback: '_finalCallback', result });
  // @ts-ignore
  process.exit(0);
}
function _importFileCb(fn: string) {
  if(fn) {
      // @ts-ignore
      process.send({ import: fn });
  }
}

process.on("message", async m => {
  if (m.command === "compile") {
    const input = m.payload;
    if(m.version === 'latest') {
      try {
        const output = await solc.compile(JSON.stringify(input), findImports);
        // @ts-ignore
        process.send({ compiled: output });
      } catch (e) {
        // @ts-ignore
        process.send({ error: e });
      }
    }
    solc.loadRemoteVersion(m.version, async (err: Error, newSolc: any) => {
      if(err) {
        // @ts-ignore
        process.send({ error: e });
      } else {
        try {
          const output = await newSolc.compile(
            JSON.stringify(input),
            findImports
          );
          // @ts-ignore
          process.send({ compiled: output });
        } catch (e) {
          // @ts-ignore
          process.send({ error: e });
        }
      }
    });
  }
  if(m.command === "fetch_compiler_verison") {
    axios
      .get("https://ethereum.github.io/solc-bin/bin/list.json")
      .then((res: any) => {
        // @ts-ignore
        process.send({ versions: res.data });
      })
      .catch((e: Error) => {
        // @ts-ignore
        process.send({ error: e });
      });
  }
  if(m.command === "run-test") {
    // TODO: move parsing to extension.ts
    // const sources = JSON.parse(m.payload);
    const rt = {
      testInterface: {
        command: 'run-test-sources',
        payload: m.payload
      }
    }
    const call = remix_tests_client.RunTests(rt);
    call.on('data', (data: any) => {
      const result = JSON.parse(data.result);
      if(result.filePath) {
        findImports(result.filePath);
      } else {
        // @ts-ignore
        process.send({ utResp: data });
      }
    });
    call.on('end', function() {
      process.exit(0);
    });
  }
});
