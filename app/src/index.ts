import 'pt-root-ui-font/bold.css'
import 'pt-root-ui-font/regular.css'
import './styles.css'
import jsQR, {QRCode} from 'jsqr'
import {Point} from 'jsqr/dist/locator'
import TicketRootContract from './contracts/TicketRootContract'
import Ton from './contracts/utils/Ton'
import config from './config/config'
import TicketTokenContract from './contracts/TicketTokenContract'

///////////////
// CONSTANTS //
///////////////
const LINE_COLOR: string = '#080'
const LINE_WIDTH: number = 4

///////////////
// VARIABLES //
///////////////
let scan: boolean

//////////////
// ELEMENTS //
//////////////
const video: HTMLVideoElement = <HTMLVideoElement> document.createElement('video')
const canvasElement: HTMLCanvasElement = <HTMLCanvasElement> document.getElementById('canvas')
const canvasContext: CanvasRenderingContext2D = canvasElement.getContext('2d')
const noteElement: HTMLElement = document.getElementById('note')
const buttonElement: HTMLElement = document.getElementById('button')

///////////////
// CONTRACTS //
///////////////
Ton.url = config.net
const ticketRootContract: TicketRootContract = new TicketRootContract()

window.onload = _ => {
    _startScan()
    buttonElement.addEventListener('click', _startScan.bind(this))
    navigator.mediaDevices.getUserMedia({
        video: {
            facingMode: 'environment'
        }
    }).then(
        stream => {
            video.srcObject = stream

            // required to tell iOS safari we don't want fullscreen
            video.setAttribute('playsinline', 'true')
            video.play().then()
            requestAnimationFrame(_tick)
        }
    )
}

function _startScan(): void {
    scan = true
    noteElement.hidden = true
    buttonElement.hidden = true
}

function _drawQRBorder(code: QRCode): void {
    const location = code.location
    const topLeftCorner: Point = location.topLeftCorner
    const topRightCorner: Point = location.topRightCorner
    const bottomRightCorner: Point = location.bottomRightCorner
    const bottomLeftCorner: Point = location.bottomLeftCorner
    canvasContext.beginPath()
    canvasContext.moveTo(topLeftCorner.x, topLeftCorner.y)
    canvasContext.lineTo(topRightCorner.x, topRightCorner.y)
    canvasContext.lineTo(bottomRightCorner.x, bottomRightCorner.y)
    canvasContext.lineTo(bottomLeftCorner.x, bottomLeftCorner.y)
    canvasContext.lineTo(topLeftCorner.x, topLeftCorner.y)
    canvasContext.lineWidth = LINE_WIDTH
    canvasContext.strokeStyle = LINE_COLOR
    canvasContext.stroke()
}

function readQRData(code: QRCode): QRData {
    const result: QRData = {
        valid: false,
        event: '',
        id: '',
        secret: ''
    }
    const data: string[] = code.data.split('-')
    if (data.length === 3) {
        result.valid = true
        result.event = data[0]
        result.id = data[1]
        result.secret = data[2]
    }
    return result
}

function _tick(): void {
    if (scan && video.readyState === video.HAVE_ENOUGH_DATA) {
        canvasElement.height = video.videoHeight
        canvasElement.width = video.videoWidth
        canvasContext.drawImage(video, 0, 0, canvasElement.width, canvasElement.height)
        const imageData: ImageData = canvasContext.getImageData(0, 0, canvasElement.width, canvasElement.height)
        const code: QRCode | null = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: 'dontInvert'
        })
        if (code) {
            scan = false
            _drawQRBorder(code)

            const qrData: QRData = readQRData(code)
            if (!qrData.valid)
                _showInvalidNote()
            else {
                _checkQRData(qrData).then((result: boolean) => {
                    if (result)
                        _showNote('green', `Ticket: #${qrData.id}`, 'Ok')
                    else
                        _showInvalidNote()
                }).catch(_ => _showInvalidNote())
            }
        }
    }
    requestAnimationFrame(_tick)
}

function _showInvalidNote(): void {
    _showNote('red', 'Invalid code', 'Ok')
}

function _showNote(className: string, noteText: string, buttonText: string): void {
    noteElement.hidden = false
    noteElement.classList.remove('red')
    noteElement.classList.remove('green')
    noteElement.classList.remove('blue')
    noteElement.classList.add(className)

    buttonElement.hidden = false
    buttonElement.classList.remove('red')
    buttonElement.classList.remove('green')
    buttonElement.classList.remove('blue')
    buttonElement.classList.add(className)

    noteElement.innerHTML = noteText
    buttonElement.innerHTML = buttonText
}

async function _checkQRData(qrData: QRData): Promise<boolean> {
    const hashFromSecret: string = await ticketRootContract.getHash(qrData.secret)
    const tokenAddress: string = await ticketRootContract.getTokenAddress(qrData.id)
    const ticketTokenContract: TicketTokenContract = new TicketTokenContract(tokenAddress)
    const tokenHash: string = await ticketTokenContract.getHash()
    return tokenHash === hashFromSecret
    return true
}

interface QRData {
    valid: boolean
    event: string
    id: string
    secret: string
}