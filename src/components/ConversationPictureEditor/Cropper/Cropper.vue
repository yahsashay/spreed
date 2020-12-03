<!--
  - @copyright Copyright (c) 2020 Marco Ambrosini <marcoambrosini@pm.me>
  -
  - @author Marco Ambrosini <marcoambrosini@pm.me>
  -
  - @license GNU AGPL version 3 or any later version
  -
  - This program is free software: you can redistribute it and/or modify
  - it under the terms of the GNU Affero General Public License as
  - published by the Free Software Foundation, either version 3 of the
  - License, or (at your option) any later version.
  -
  - This program is distributed in the hope that it will be useful,
  - but WITHOUT ANY WARRANTY; without even the implied warranty of
  - MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
  - GNU Affero General Public License for more details.
  -
  - You should have received a copy of the GNU Affero General Public License
  - along with this program. If not, see <http://www.gnu.org/licenses/>.
-->

<template>
	<div class="cropper">
		<VueCropper
			ref="cropper"
			v-bind="$attrs"
			:src="imgSrc"
			:view-mode="1"
			drag-mode="move"
			:crop-box-movable="false"
			:crop-box-resizable="false"
			:initial-aspect-ratio="1"
			:aspect-ratio="1"
			:responsive="true"
			alt="Source Image" />
		<div class="actions" />
	</div>
</template>

<script>
import VueCropper from 'vue-cropperjs'
/* eslint-disable-next-line */
import 'cropperjs/dist/cropper.css'

export default {
	name: 'Cropper',

	components: {
		VueCropper,
	},

	props: {
		imgSrc: {
			type: String,
			required: true,
		},
	},
}
</script>

<style lang="scss" scoped>

::v-deep .cropper-view-box {
	border-radius: 50%;
	border: 1px solid var(--color-primary-element);
	outline: none;
}
</style>
