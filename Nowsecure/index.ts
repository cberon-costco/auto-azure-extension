//////////////////////////////////////////////////////////////////////////
// Node code for calling Java app
//////////////////////////////////////////////////////////////////////////
import * as tl from "azure-pipelines-task-lib/task";
import fs = require("fs");
import path = require("path");

let onError = function (errMsg: string, code: number) {
  tl.error(errMsg);
  tl.setResult(tl.TaskResult.Failed, errMsg);
}

//////////////////////////////////////////////////////////////////////////
// Read parameters
//////////////////////////////////////////////////////////////////////////
let filepath = tl.getInput("filepath", true);
tl.debug("filepath: " + filepath);

let group = tl.getInput("group", true);
tl.debug("group: " + group);

let token = tl.getInput("token", true);
tl.debug("token: " + token);

let username = tl.getInput("username", false);
tl.debug("username: " + username);

let password = tl.getInput("password", false);

let url = tl.getInput("url", false);
tl.debug("url: " + url);

let artifactsDir = tl.getInput("artifactsDir", true);
tl.debug("artifactsDir: " + artifactsDir);

let scoreThreshold = tl.getInput("scoreThreshold", false);
tl.debug("scoreThreshold: " + scoreThreshold);

let waitMinutes = tl.getInput("waitMinutes", false);
tl.debug("waitMinutes: " + waitMinutes);

let showStatusMessages = tl.getInput("showStatusMessages", false);
tl.debug("showStatusMessages: " + showStatusMessages);

//////////////////////////////////////////////////////////////////////////
// Resolve Filepath if user gave us **/*.ipa syntax
//////////////////////////////////////////////////////////////////////////
// we allow broken symlinks - since there could be broken symlinks found in source folder, but filtered by contents pattern
const findOptions: tl.FindOptions = {
    allowBrokenSymbolicLinks: true,
    followSpecifiedSymbolicLink: true,
    followSymbolicLinks: true
};

// clean up user supplied folder path
let sourceFolder: string = path.dirname(filepath);
sourceFolder: string = path.normalize(sourceFolder);

let allPaths: string[] = tl.find(sourceFolder, findOptions);
let sourceFolderPattern = sourceFolder.replace('[', '[[]'); // directories can have [] in them, and they have special meanings as a pattern, so escape them

// resolve * or ** syntax
let content: string = path.basename(filepath);

let matchedPaths: string[] = tl.match(allPaths, content, sourceFolderPattern); // default match options
let matchedFiles: string[] = matchedPaths.filter((itemPath: string) => !stats(itemPath, false).isDirectory()); // filter-out directories

console.log(tl.loc('FoundNFiles', matchedFiles.length));

if (matchedFiles.length > 0) {
  // just take the first match
  console.log(tl.loc('Processing', matchedFiles[0]));

//////////////////////////////////////////////////////////////////////////
// Find Java executable and set parameters
//////////////////////////////////////////////////////////////////////////
let task = JSON.parse(fs.readFileSync(path.join(__dirname, "task.json")).toString());
let version = `${task.version.Major}.${task.version.Minor}.${task.version.Patch}`

let javaPath = tl.which("java");
if (!javaPath) {
  onError("java is not found in the path", 1);
}
let java = tl.tool("java");
let nsAPI = path.join(__dirname, "nowsecure-ci.jar");

java.arg("-jar");
java.arg(nsAPI);


java.arg("--plugin-name");
java.arg("azure-nowsecure-auto-security-test");
java.arg("--plugin-version");
java.arg(version);
java.arg("--file");
java.arg(matchedFiles[0]);
java.arg("--group-id");
java.arg(group);
java.arg("--token");
java.arg(token);
java.arg("--dir");
java.arg(artifactsDir);

if (url) {
  java.arg("--url");
  java.arg(url);
}

if (waitMinutes) {
  java.arg("--wait");
  java.arg(waitMinutes);
} else {
  java.arg("--wait");
  java.arg("0");
}

if (showStatusMessages) {
  java.arg("--show-status-messages");
  java.arg(showStatusMessages);
} else {
  java.arg("--show-status-messages");
  java.arg("true");
}

if (username) {
  java.arg("--username");
  java.arg(username);
}
if (password) {
  java.arg("--password");
  java.arg(password);
}
if (scoreThreshold) {
  java.arg("--score");
  java.arg(scoreThreshold);
} else {
  java.arg("--score");
  java.arg("0");
}

if (process.env.SYSTEM_DEBUG) {
  java.arg("--debug");
}

java.on("stdout", function (data: Buffer) {
  console.log(data.toString());
});

console.log(java);

//////////////////////////////////////////////////////////////////////////
// Starting Java app to process the app for preflight and assessment 
// based on above config.
//////////////////////////////////////////////////////////////////////////
java.exec()
  .then(function (code: number) {
    tl.debug("code: " + code);
    if (code != 0) {
      onError("azure-nowsecure-auto-security-test upload and security test failed.", code);
    }
  })
  .fail(function (err: Error) {
    onError("azure-nowsecure-auto-security-test upload and security test failed [" + err.toString() + "]", 1);
  });
}
