import Contract from './base/Contract'
import {DecodedMessageBody} from '@tonclient/core/dist/modules'
import ticketRootAbi from './abi/TicketRoot.abi.json'
import config from '../config/config'

export default class TicketRootContract extends Contract {
    public constructor() {
        super({
            abi: ticketRootAbi,
            address: config.address
        })
    }



    /***********
     * GETTERS *
     ***********/
    public async getTokenAddress(id: string): Promise<string> {
        const result: DecodedMessageBody = await this._run('getTokenAddress', {id: id})
        return result.value['addr']
    }

    public async getHash(key: string): Promise<string> {
        const result: DecodedMessageBody = await this._run('getHash', {key: key})
        return result.value['hash']
    }
}