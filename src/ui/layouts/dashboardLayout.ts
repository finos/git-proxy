/**
 * Copyright 2026 GitProxy Contributors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/** Full-width shell: grid gives the scroll region a definite height so short pages still fill the viewport (sticky footer). */
export const dashboardWrapperClass =
  'relative top-0 grid min-h-screen grid-rows-[auto_minmax(0,1fr)] bg-(--bgColor-default)';

/** Scrolls when routes overflow; nested flex column lets content grow to the row height (sticky footer). */
export const dashboardMainPanelClass =
  'flex min-h-0 w-full flex-col overflow-auto [-webkit-overflow-scrolling:touch] [transition:all_0.33s_cubic-bezier(0.685,0.0473,0.346,1)]';

/** Grows with the main panel so the column + footer fill short pages to the bottom of the viewport. */
export const dashboardContentClass = 'flex min-h-0 flex-1 flex-col items-stretch pt-6 pb-2';

const dashboardColumnBaseClass =
  'relative mx-auto box-border flex min-h-0 w-full flex-1 flex-col px-4 sm:px-6';

/** Centered column: flex column + flex:1 so it stretches; routes use a flex-grow wrapper for sticky footer behavior. */
export const dashboardColumnClass = `${dashboardColumnBaseClass} max-w-6xl`;

/** Same as `dashboardColumnClass` but full content width (e.g. Activity list + wide tables). */
export const dashboardColumnFullWidthClass = `${dashboardColumnBaseClass} max-w-none`;

/** Grows to absorb space above the footer on short pages. */
export const dashboardRoutesGrowClass = 'flex min-h-0 w-full flex-1 flex-col';

export const dashboardMapClass = 'box-border flex min-h-0 flex-1 p-4';
