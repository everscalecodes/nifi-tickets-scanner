import {ClientConfig, TonClient} from '@tonclient/core'
import {libWeb} from '@tonclient/lib-web'
import {KeyPair} from '@tonclient/core/dist/modules'

export default class Ton {
    public static timeout: number

    private static _url: string
    private static _client: TonClient

    public static set url(value: string) {
        Ton._url = value
    }

    /**
     * Creates a client, stores the link in a static variable, return client
     * @return {TonClient}
     * @throws {Error}
     */
    public static get client(): TonClient {
        if (Ton._client)
            return Ton._client

        if (!this._url)
            throw new Error(`URL doesn't set`)

        TonClient.useBinaryLibrary(libWeb)
        const config: ClientConfig = {
            network: {
                server_address: Ton._url
            }
        }
        return new TonClient(config)
    }

    /**
     * Wrapper for crypto.generate_random_sign_keys()
     * @return {Promise<KeyPair>}
     */
    public static async randomKeys(): Promise<KeyPair> {
        return await Ton.client.crypto.generate_random_sign_keys()
    }

    /**
     * Add 0x to number or string
     * @param {number} number Example:
     *     '123'
     * @return {string} Example:
     *     '0x123'
     */
    public static x0(number: number | string): string {
        return `0x${number}`
    }

    /**
     * Convert abi to hex.
     * @param {Object} abi Example:
     *     '{ABI ver...'
     * @return {string} Example:
     *     '7b0a0922...'
     */
    public static abiToHex(abi: Object): string {
        return Ton.stringToHex(JSON.stringify(abi))
    }

    /**
     * Convert array of strings to hex.
     * @param {string[]} strings Example:
     *     ['XYZ123', 'ABC456']
     * @return {string} Example:
     *     ['58595a313233', '414243343536']
     */
    public static stringsToHex(strings: string[]): string[] {
        return strings.map(x => Ton.stringToHex(x))
    }

    /**
     * Convert string to hex.
     * @param {string} string Example:
     *     'XYZ123'
     * @return {string} Example:
     *     '58595a313233'
     */
    public static stringToHex(string: string): string {
        return string.split('').map(x => x.charCodeAt(0).toString(16)).join('')
    }
}