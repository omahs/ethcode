import React, { Component } from 'react';
import JSONPretty from 'react-json-pretty';
import "./deploy.css";
import { connect } from "react-redux";
import { setUnsgTxn } from "../../actions";
import { IAccount } from 'types';

export interface IProps {
  setUnsgTxn: (unsgTxn: any) => void;
  contractName: string;
  bytecode: any;
  abi: any;
  vscode: any;
  errors: any;
  compiledResult: object;
  testNetId: string;
  currAccount: IAccount;
  unsignedTx: any;
}

export interface IState {
  showUnsignedTxn: boolean;
  constructorInput: object[];
  error: string;
  deployed: object;
  gasEstimate: number;
  bytecode: any;
  abi: any;
  txtHash: string;
  pvtKey: string;
  msg: string;
  processMessage: string;
}

class Deploy extends Component<IProps, IState> {
  constructor(props: IProps) {
    super(props);
    this.state = {
      showUnsignedTxn: false,
      constructorInput: [],
      error: '',
      deployed: {},
      gasEstimate: 0,
      bytecode: {},
      abi: {},
      txtHash: '',
      pvtKey: '',
      msg: 'initial',
      processMessage: ''
    };
    this.handleBuildTxn = this.handleBuildTxn.bind(this);
    this.getGasEstimate = this.getGasEstimate.bind(this);
  }

  componentDidMount() {
    const { abi, bytecode, vscode, currAccount, setUnsgTxn } = this.props;
    this.setState({ abi, bytecode });

    window.addEventListener("message", event => {
      const { data } = event;

      if (data.deployedResult) {
        this.setState({ txtHash: data.deployedResult });
      }

      if (data.gasEstimate) {
        this.setState({ gasEstimate: data.gasEstimate });
      }
      if (data.buildTxResult) {
        // TODO: fix unsigned tx is not updated after once
        setUnsgTxn(data.buildTxResult);
      }
      if (data.pvtKey) {
        // TODO: fetching private key process needs fix
        console.log("Setting active private key");
        console.log(data.pvtKey);
        this.setState({ pvtKey: data.pvtKey, processMessage: '' }, () => {
          this.setState({ msg: 'process finshed' });
        });
      }
    });
    // get private key for corresponding public key
    if (currAccount.type === 'Local') {
      this.setState({ processMessage: 'FETCHING PRIVATE KEY...'  });
      vscode.postMessage({ command: "get-pvt-key", payload: currAccount.pubAddr ? currAccount.pubAddr : currAccount.value });
    }

    // this.setState({ deployed: this.props.compiledResult });
    // for (let i in abi) {
    //   if (abi[i].type === 'constructor' && abi[i].inputs.length > 0) {
    //     const constructorInput = JSON.parse(JSON.stringify(abi[i].inputs));
    //     for (let j in constructorInput) {
    //       constructorInput[j]['value'] = "";
    //     }
    //     this.setState({ constructorInput: constructorInput });
    //     break;
    //   }
    // }
  }

  handleBuildTxn = () => {
    const { vscode, bytecode, abi, currAccount, testNetId } = this.props;
    const { constructorInput, gasEstimate } = this.state;
    const publicKey = currAccount.value;
    // create unsigned transaction here
    try {
      vscode.postMessage({
        command: "build-rawtx",
        payload: {
          from: publicKey,
          abi,
          bytecode,
          params: constructorInput ? constructorInput : [],
          gasSupply: gasEstimate ? gasEstimate : 0
        },
        testNetId
      });
    } catch (error) {
      this.setState({ error });
    }
  };

  getGasEstimate = () => {
    const { vscode, bytecode, abi, testNetId } = this.props;
    const { constructorInput } = this.state;

    try {
      vscode.postMessage({
        command: "run-get-gas-estimate",
        payload: {
          abi,
          bytecode,
          params: constructorInput
        },
        testNetId
      });
    } catch (err) {
      this.setState({ error: err });
    }
  };

  signAndDeploy = () => {
    const { vscode, unsignedTx, testNetId } = this.props;
    const { pvtKey } = this.state;
    this.setState({ msg: 'Process start' });
    try {
      vscode.postMessage({
        command: "sign-deploy-tx",
        payload: {
          unsignedTx,
          pvtKey
        },
        testNetId
      });
    } catch (error) {
      this.setState({ error });
    }
  };

  render() {
    const { contractName, currAccount, unsignedTx, errors } = this.props;
    const { gasEstimate, bytecode, abi, txtHash, pvtKey, processMessage } = this.state;
    const publicKey = currAccount.value;

    return (
      <div className="deploy_container">
        {/* Bytecode and Abi */}
        <div>
          <h4 className="tag contract-name inline-block highlight-success">
            Contract Name: <span>{contractName}</span>
          </h4>
          <div className="byte-code" style={{ marginBottom: '15px' }}>
            <input
              className="input custom_input_css"
              style={{ width: '80vw' }}
              type="text"
              name="bytecode"
              onChange={(e) => this.setState({ bytecode: e.target.value })}
              value={bytecode}
              placeholder="byte code"
              disabled />
          </div>
          <div className="abi-definition">
            <input
              className="input custom_input_css"
              style={{ width: '80vw' }}
              type="text"
              name="abi"
              onChange={(e) => this.setState({ abi: JSON.parse(e.target.value) })}
              value={JSON.stringify(abi)}
              placeholder="abi"
              disabled />
          </div>
          <div>
            {
              errors &&
              <div>
                {errors}
              </div>
            }
          </div>
        </div>
        {/* Constructor */}
        <div>
          <h4 className="tag contract-name inline-block highlight-success">
            Constructor:
          </h4>
          <div className="json_input_container" style={{ marginTop: '10px' }}>
            <textarea className="json_input custom_input_css"></textarea>
          </div>
        </div>
        {/* Get gas estimate */}
        <div className="account_row">
          <div className="input-container">
            <button className="acc-button custom_button_css" onClick={this.getGasEstimate}>Get gas estimate</button>
          </div>
          <div className="input-container">
            <input className="input custom_input_css" disabled type="text" placeholder="gas supply" value={gasEstimate} />
          </div>
        </div>

        <div className="input-container">
          <button className="acc-button custom_button_css" onClick={this.handleBuildTxn}>Build transaction</button>
        </div>

        {
          unsignedTx &&
          <div className="tag">
            <h4 className="contract-name inline-block highlight-success">
              Unsigned Transaction:
            </h4>
            <div className="json_input_container" style={{ marginTop: '10px' }}>
              <pre className="large-code">
                <JSONPretty id="json-pretty" data={unsignedTx}></JSONPretty>
              </pre>
              {/* <textarea className="json_input custom_input_css">{unsignedTx}</textarea> */}
            </div>
          </div>
        }

        <div className="account_row">
          <div className="tag">
            <h4>Public key</h4>
          </div>
          <div className="input-container">
            <input className="input custom_input_css" type="text" value={publicKey} placeholder="public key" />
          </div>
        </div>

        <div className="account_row">
          <div className="tag">
            <h4>Private key</h4>
          </div>
          <div className="input-container">
            <input className="input custom_input_css" type="text" disabled placeholder="private key" value={pvtKey} />
          </div>
        </div>

        <div className="account_row">
          <div className="tag">
            {pvtKey ?
              <button className="acc-button custom_button_css" onClick={this.signAndDeploy}>Sign & Deploy</button>
              : <button disabled={true} className="acc-button button_disable custom_button_css" onClick={this.signAndDeploy}>Sign & Deploy</button>
            }
          </div>
        </div>

        {/* Final Transaction Hash */}
        { pvtKey &&
        <div className="account_row">
          <div className="tag">
            <h4>Transaction hash</h4>
          </div>
          <div className="input-container">
            <input className="input custom_input_css" type="text" value={txtHash} placeholder="transaction hash" />
          </div>
        </div>}
        {
          processMessage &&
          <pre className="processMessage">{processMessage}</pre>
        }
      </div>
    );
  }
}

function mapStateToProps({ compiledStore, debugStore, accountStore, txStore }: any) {
  const { compiledResult, callResult } = compiledStore;
  const { testNetId } = debugStore;
  const { currAccount } = accountStore;
  const { unsignedTx } = txStore;
  return {
    compiledResult,
    callResult,
    testNetId,
    currAccount,
    unsignedTx
  };
}

export default connect(mapStateToProps, {
  setUnsgTxn
})(Deploy);