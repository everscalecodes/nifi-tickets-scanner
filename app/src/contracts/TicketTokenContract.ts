import Contract from './base/Contract'
import {DecodedMessageBody} from '@tonclient/core/dist/modules'
import ticketRootAbi from './abi/TicketToken.abi.json'

export default class TicketTokenContract extends Contract {
    public constructor(address: string) {
        super({
            abi: ticketRootAbi,
            address: address
        })
    }



    /***********
     * GETTERS *
     ***********/
    public async getHash(): Promise<string> {
        const result: DecodedMessageBody = await this._run('getTicketInfo')
        return result.value['hash']
    }
}