import { reactive } from 'vue';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	MireModal — opens and closes the Mire as a modal over the main window
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** The state of the Mire modal: not saved, the modal starts closed. */
export const mireModal = reactive({
	/** True while the Mire modal shows. */
	isOpen: false,
});

/** Opens and closes the Mire modal. */
export class MireModal {
	/** Opens the Mire modal. The Mire view registers in the shared collector when it mounts. */
	static open(): void {
		mireModal.isOpen = true;
	}

	/** Closes the Mire modal. The Mire view leaves the shared collector when it unmounts. */
	static close(): void {
		mireModal.isOpen = false;
	}
}
