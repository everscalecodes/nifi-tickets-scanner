import {
    Abi,
    AbiContract,
    DecodedMessageBody,
    KeyPair,
    ResultOfEncodeMessage, ResultOfEncodeMessageBody,
    ResultOfProcessMessage,
    ResultOfQueryCollection,
    ResultOfRunTvm,
    ResultOfWaitForCollection,
    Signer
} from '@tonclient/core/dist/modules'
import {TonClient} from '@tonclient/core'
import Ton from '../utils/Ton'
import ContractConfig from './interfaces/ContractConfig'
import DeployedContractConfig from './interfaces/DeployedContractConfig'

export default class Contract {
    private readonly _client: TonClient
    private readonly _abi: Abi
    private readonly _initialData: Object
    private readonly _keys: KeyPair
    private readonly _tvc: string
    private _address: string
    private _lastTransactionLogicTime: number



    /**********
     * PUBLIC *
     **********/
    /**
     * @param config {ContractConfig | DeployedContractConfig} Examples:
     *     // Already deployment contract
     *     {
     *         abi: {"ABI version": 2, '...'}
     *         address: '0:7777777777777777777777777777777777777777777777777777777777777777'
     *     }
     *
     *     // New contract
     *     {
     *         abi: {"ABI version": 2, '...'}
     *         initialData: {name: 'bot'}
     *         keys: {public: '...', secret: '...'}
     *         tvc: 'te6ccgECLAEAB6oAAgE0 ...'
     *     }
     */
    public constructor(config: ContractConfig | DeployedContractConfig) {
        this._client = Ton.client
        this._abi = Contract._getAbi(config.abi)
        this._initialData = config.initialData
        this._tvc = config.tvc
        this._keys = config.keys
        this._address = config.address
        this._lastTransactionLogicTime = 0
    }

    /**
     * Called once. Use if you want to know the address of the contract before deployment.
     * Example:
     *     const keys: KeyPair = await Ton.client.crypto.generate_random_sign_keys()
     *     const root: RootContract = new RootContract(keys)
     *     const rootAddress: string = await root.calculateAddress()
     */
    public async calculateAddress(): Promise<string> {
        if (this._address)
            return this._address

        const encodedMessage: ResultOfEncodeMessage = await this._client.abi.encode_message({
            abi: this._abi,
            signer: this._getSigner(),
            deploy_set: {
                tvc: this._tvc,
                initial_data: this._initialData
            }
        })
        return this._address = encodedMessage.address
    }

    /**
     * Use this if you want to wait for a transaction from one contract to another. Example:
     *     const sender: SenderContract = new SenderContract()
     *     const receiver: ReceiverContract = new ReceiverContract()
     *
     *     // Deployment here...
     *
     *     const receiverAddress: string = await receiver.calculateAddress()
     *     await sender.send(receiverAddress, 1000000000)
     *     const waitingResult: boolean = await receiver.waitForTransaction(5000)
     * @param {number} timeout. Time in milliseconds. Examples:
     *     3000
     *     5000
     */
    public async waitForTransaction(timeout?: number): Promise<boolean> {
        timeout = timeout ?? Ton.timeout
        try {
            const queryCollectionResult: ResultOfQueryCollection = await this._client.net.wait_for_collection({
                collection: 'accounts',
                filter: {
                    id: {
                        eq: await this.calculateAddress()
                    },
                    last_trans_lt: {
                        gt: this._lastTransactionLogicTime.toString()
                    }
                },
                result: 'last_trans_lt',
                timeout: timeout
            })
            this._lastTransactionLogicTime = queryCollectionResult.result['last_trans_lt']
            return true
        } catch (error: any) {
            return false
        }
    }



    /*************
     * PROTECTED *
     *************/
    protected async _run(method: string, input: Object = {}): Promise<DecodedMessageBody> {
        //////////////
        // Read boc //
        //////////////
        const queryCollectionResult: ResultOfQueryCollection = await this._client.net.query_collection({
            collection: 'accounts',
            filter: {
                id: {
                    eq: await this.calculateAddress()
                }
            },
            result: 'boc'
        })
        const account: string = queryCollectionResult.result[0]['boc']

        /////////
        // Run //
        /////////
        const encodedMessage: ResultOfEncodeMessage = await this._client.abi.encode_message({
            abi: this._abi,
            signer: this._getSigner(),
            call_set: {
                function_name: method,
                input: input
            },
            address: this._address
        })
        const message: ResultOfRunTvm = await this._client.tvm.run_tvm({
            message: encodedMessage.message,
            account: account
        })

        ///////////////////
        // Decode result //
        ///////////////////
        const outMessages: string = message.out_messages[0]
        return await this._client.abi.decode_message({
            abi: this._abi,
            message: outMessages
        })
    }

    protected async _call(method: string, input: Object = {}, keys?: KeyPair | 'none'): Promise<ResultOfProcessMessage> {
        const processMessageResult: ResultOfProcessMessage = await this._client.processing.process_message({
            message_encode_params: {
                abi: this._abi,
                signer: this._getSigner(keys),
                address: await this.calculateAddress(),
                call_set: {
                    function_name: method,
                    input: input
                }
            },
            send_events: false
        })
        await this.waitForTransaction()
        return processMessageResult
    }

    protected async _deploy(input: Object = {}): Promise<boolean> {
        /////////////////////////////
        // Waiting for balance > 0 //
        /////////////////////////////
        const waitingNoCodeCollectionResult: ResultOfWaitForCollection = await this._client.net.wait_for_collection({
            collection: 'accounts',
            filter: {
                id: {
                    eq: await this.calculateAddress()
                },
                data: {
                    eq: null
                },
                code: {
                    eq: null
                },
                balance: {
                    gt: '0'
                }
            },
            result: 'last_trans_lt'
        })
        this._lastTransactionLogicTime = waitingNoCodeCollectionResult.result['last_trans_lt']

        ////////////
        // Deploy //
        ////////////
        const encodedMessage: ResultOfEncodeMessage = await this._client.abi.encode_message({
            abi: this._abi,
            signer: this._getSigner(),
            deploy_set: {
                tvc: this._tvc,
                initial_data: this._initialData
            },
            call_set: {
                function_name: 'constructor',
                input: input
            }
        })
        await this._client.processing.send_message({
            message: encodedMessage.message,
            send_events: false
        })

        ////////////////////////////////////////
        // Waiting for deployment transaction //
        ////////////////////////////////////////
        return await this.waitForTransaction()
    }

    protected async _getPayloadToCallAnotherContract(
        abi: AbiContract,
        method: string,
        input: Object = {}
    ): Promise<string> {
        const resultOfEncoding: ResultOfEncodeMessageBody = await this._client.abi.encode_message_body({
            abi: Contract._getAbi(abi),
            signer: this._getSigner('none'),
            call_set: {
                function_name: method,
                input: input
            },
            is_internal: true
        })
        return resultOfEncoding.body
    }



    /***********
     * PRIVATE *
     ***********/
    private _getSigner(keys?: KeyPair | 'none'): Signer {
        const keyPair: KeyPair = keys === 'none' ? undefined : keys ?? this._keys
        return keyPair ? {
            type: 'Keys',
            keys: keyPair
        } : {
            type: 'None'
        }
    }

    private static _getAbi(abi: AbiContract): Abi {
        return {
            type: 'Contract',
            value: abi
        }
    }
}